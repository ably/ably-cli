import fetch, { type Response as FetchResponse } from "node-fetch";

/**
 * Default OAuth authorization-server host. Shared with config-manager so the
 * session-key scope matches the host that actually minted the tokens. Kept
 * distinct from the Control API host (control.ably.net) — they are separate
 * services that happen to share the ably.com brand.
 */
export const DEFAULT_OAUTH_HOST = "ably.com";

/**
 * Thrown by refreshAccessToken when the server rejects the refresh token
 * (OAuth error "invalid_grant"). This happens when:
 *   - the refresh token was revoked (e.g. by logout)
 *   - it was rotated by a concurrent refresh (single-use refresh tokens)
 *   - the session has otherwise expired server-side
 * Callers should treat this as "session ended, re-login required" rather
 * than a transient network failure.
 */
export class OAuthRefreshExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OAuthRefreshExpiredError";
  }
}

export interface OAuthTokens {
  accessToken: string;
  expiresAt: number;
  refreshToken: string;
  scope?: string;
  tokenType: string;
  userEmail?: string;
  userId?: string;
}

export interface OAuthConfig {
  clientId: string;
  deviceCodeEndpoint: string;
  revocationEndpoint: string;
  scopes: string[];
  tokenEndpoint: string;
}

export interface OAuthClientOptions {
  oauthHost?: string;
}

export interface DeviceCodeResponse {
  deviceCode: string;
  expiresIn: number;
  interval: number;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
}

export class OAuthClient {
  private config: OAuthConfig;

  constructor(options: OAuthClientOptions = {}) {
    this.config = this.getOAuthConfig(options.oauthHost);
  }

  /**
   * Request a device code from the OAuth server (RFC 8628 step 1).
   * A 15s abort timeout prevents a silently hung endpoint from blocking
   * `ably login` indefinitely.
   */
  async requestDeviceCode(): Promise<DeviceCodeResponse> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      scope: this.config.scopes.join(" "),
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let response;
    try {
      response = await fetch(this.config.deviceCodeEndpoint, {
        body: params.toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        method: "POST",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Device code request failed (${response.status}): ${errorBody}`,
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    return {
      deviceCode: data.device_code as string,
      expiresIn: (data.expires_in as number) || 300,
      interval: (data.interval as number) || 5,
      userCode: data.user_code as string,
      verificationUri: data.verification_uri as string,
      verificationUriComplete: data.verification_uri_complete as string,
    };
  }

  /**
   * Poll for token completion (RFC 8628 step 2).
   * Sleeps between requests, respects slow_down, and throws on expiry/denial.
   */
  async pollForToken(
    deviceCode: string,
    interval: number,
    expiresIn: number,
  ): Promise<OAuthTokens> {
    const deadline = Date.now() + expiresIn * 1000;
    let currentInterval = interval;
    let networkRetries = 0;
    const maxNetworkRetries = 3;

    while (Date.now() < deadline) {
      // Apply ±20% jitter so concurrent clients don't fall into lockstep and
      // hit the authorization server in synchronized bursts, which trips the
      // shared rate limit long before any individual client is misbehaving.
      const jitterFactor = 0.9 + Math.random() * 0.2;
      await this.sleep(currentInterval * 1000 * jitterFactor);

      if (Date.now() >= deadline) {
        throw new Error("Device code expired");
      }

      let response;
      const controller = new AbortController();
      // Per-poll 15s timeout — without this a single hung fetch would block
      // the outer `while (Date.now() < deadline)` guard and spin the spinner
      // forever with no error.
      const timeout = setTimeout(() => controller.abort(), 15_000);
      try {
        const params = new URLSearchParams({
          client_id: this.config.clientId,
          device_code: deviceCode,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        });

        response = await fetch(this.config.tokenEndpoint, {
          body: params.toString(),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          method: "POST",
          signal: controller.signal,
        });
        networkRetries = 0;
      } catch {
        networkRetries++;
        if (networkRetries >= maxNetworkRetries) {
          throw new Error(
            "Network error: failed to reach token endpoint after multiple retries",
          );
        }
        continue;
      } finally {
        clearTimeout(timeout);
      }

      if (response.ok) {
        const data = (await response.json()) as Record<string, unknown>;
        return this.parseTokenResponse(data);
      }

      const { code, description } = await parseOAuthError(response);

      switch (code) {
        case "authorization_pending": {
          continue;
        }
        case "slow_down": {
          currentInterval += 5;
          continue;
        }
        case "rate_limited": {
          // Honour server-supplied Retry-After; fall back to exponential
          // backoff capped at 30s if the header is missing or unparseable.
          const retryAfter = Number(response.headers.get("retry-after"));
          currentInterval =
            Number.isFinite(retryAfter) && retryAfter > 0
              ? Math.min(retryAfter, 60)
              : Math.min(currentInterval * 2, 30);
          continue;
        }
        case "expired_token": {
          throw new Error("Device code expired");
        }
        case "access_denied": {
          throw new Error("Authorization denied");
        }
        default: {
          const reason = description ?? code ?? `HTTP ${response.status}`;
          throw new Error(`Token polling failed: ${reason}`);
        }
      }
    }

    throw new Error("Device code expired");
  }

  /**
   * Refresh an access token using a refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    return this.postForTokens(
      {
        client_id: this.config.clientId,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      },
      "Token refresh",
      refreshToken,
    );
  }

  /**
   * Revoke a token (access or refresh).
   *
   * Rejects on network failure, timeout, or non-2xx response. Callers that
   * want best-effort behaviour (e.g. accounts logout) must catch the rejection
   * themselves — surfacing it lets the caller distinguish a successful revoke
   * from a timed-out one so it can warn the user.
   *
   * Pass an external `signal` to abort the in-flight fetch from the outside
   * (the internal 10s timeout is still applied as a safety net).
   */
  async revokeToken(
    token: string,
    options: { signal?: AbortSignal; timeoutMs?: number } = {},
  ): Promise<void> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      token,
    });

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? 10_000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    // Link the caller-supplied signal to our internal controller so aborting
    // the outer signal also cancels the fetch.
    const externalSignal = options.signal;
    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener("abort", onExternalAbort);
      }
    }

    try {
      const response = await fetch(this.config.revocationEndpoint, {
        body: params.toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        method: "POST",
        signal: controller.signal,
      });
      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(
          `Token revocation failed (${response.status})${errorBody ? `: ${errorBody}` : ""}`,
        );
      }
    } finally {
      // Always clear the timer, even on fetch rejection, or the pending
      // setTimeout keeps the event loop alive for up to 10s after the
      // command has otherwise finished.
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", onExternalAbort);
    }
  }

  getClientId(): string {
    return this.config.clientId;
  }

  // --- Private helpers ---

  private getOAuthConfig(oauthHost = DEFAULT_OAUTH_HOST): OAuthConfig {
    const scheme = oauthHost.includes("local") ? "http" : "https";
    return {
      // Per RFC 8628 §3.1 and RFC 6749 §2.1, the device flow uses a public
      // client — there is no client secret, and the client_id is not
      // confidential. It is intentionally embedded in the binary; distributing
      // it publicly does not weaken the security of the flow.
      clientId: "gb-I8-bZRnXs-gF83jOWKQrUxPPWp_ldTfQtgGP0EFg",
      deviceCodeEndpoint: `${scheme}://${oauthHost}/oauth/authorize_device`,
      revocationEndpoint: `${scheme}://${oauthHost}/oauth/revoke`,
      scopes: ["full_access"],
      tokenEndpoint: `${scheme}://${oauthHost}/oauth/token`,
    };
  }

  private async postForTokens(
    params: Record<string, string>,
    operationName: string,
    fallbackRefreshToken?: string,
  ): Promise<OAuthTokens> {
    const body = new URLSearchParams(params);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let response;
    try {
      response = await fetch(this.config.tokenEndpoint, {
        body: body.toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        method: "POST",
        signal: controller.signal,
      });
    } finally {
      // Always clear the timer — on network/TLS failure the exception
      // propagates past clearTimeout and the setTimeout stays pending.
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const { code, description } = await parseOAuthError(response);
      // Detect invalid_grant on refresh: the refresh token is gone (revoked,
      // rotated by a concurrent refresh, or otherwise expired). Surface this
      // as a typed error so callers can prompt the user to re-login.
      if (params.grant_type === "refresh_token" && code === "invalid_grant") {
        throw new OAuthRefreshExpiredError(
          "OAuth refresh token is no longer valid. Please run 'ably login' again.",
        );
      }
      const reason = description ?? code ?? `HTTP ${response.status}`;
      throw new Error(`${operationName} failed: ${reason}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return this.parseTokenResponse(data, fallbackRefreshToken);
  }

  private parseTokenResponse(
    data: Record<string, unknown>,
    fallbackRefreshToken?: string,
  ): OAuthTokens {
    const accessToken =
      typeof data.access_token === "string" ? data.access_token : undefined;
    const refreshToken =
      typeof data.refresh_token === "string"
        ? data.refresh_token
        : fallbackRefreshToken;

    if (!accessToken || !refreshToken) {
      throw new Error("Token response missing required fields");
    }

    const expiresIn = (data.expires_in as number) || 3600;
    return {
      accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
      refreshToken,
      scope: data.scope as string | undefined,
      tokenType: (data.token_type as string) || "Bearer",
      userEmail: data.user_email as string | undefined,
      userId:
        typeof data.user_id === "string"
          ? data.user_id
          : typeof data.user_id === "number"
            ? String(data.user_id)
            : undefined,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Parse an RFC 6749 §5.2 OAuth error body: `{error: "<code>",
 * error_description?: "<human>"}`. Never throws — a non-JSON or unexpected
 * body degrades to `{}` so callers fall through to their HTTP-status fallback.
 */
async function parseOAuthError(
  response: FetchResponse,
): Promise<{ code?: string; description?: string }> {
  try {
    const data = (await response.json()) as Record<string, unknown>;
    return {
      code: typeof data.error === "string" ? data.error : undefined,
      description:
        typeof data.error_description === "string"
          ? data.error_description
          : undefined,
    };
  } catch {
    return {};
  }
}
