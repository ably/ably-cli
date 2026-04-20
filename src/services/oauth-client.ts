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

      // Handle rate limiting before attempting to parse the error body. An
      // OAuth-compliant server would return error=slow_down, but the current
      // website reuses the Control API error envelope for 429s, so we bail
      // out to backoff on status alone and don't depend on a specific shape.
      if (response.status === 429) {
        currentInterval = Math.min(currentInterval * 2, 30);
        // Best-effort consume body so the socket can be released even if the
        // server wrote one; failures here are irrelevant.
        try {
          await response.text();
        } catch {
          // ignore
        }
        continue;
      }

      const { code: errorCode, message: errorMessage } =
        await parsePollingError(response);

      if (errorCode === "authorization_pending") {
        continue;
      }

      if (errorCode === "slow_down") {
        currentInterval += 5;
        continue;
      }

      if (errorCode === "expired_token") {
        throw new Error("Device code expired");
      }

      if (errorCode === "access_denied") {
        throw new Error("Authorization denied");
      }

      const reason = errorMessage ?? errorCode ?? `HTTP ${response.status}`;
      throw new Error(`Token polling failed: ${reason}`);
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
      const errorBody = await response.text();
      // Detect invalid_grant on refresh: the refresh token is gone (revoked,
      // rotated by a concurrent refresh, or otherwise expired). Surface this
      // as a typed error so callers can prompt the user to re-login instead
      // of showing a raw HTTP error body.
      if (params.grant_type === "refresh_token") {
        let oauthError: string | undefined;
        try {
          oauthError = (JSON.parse(errorBody) as { error?: string }).error;
        } catch {
          // Non-JSON body — fall through to generic error.
        }
        if (oauthError === "invalid_grant") {
          throw new OAuthRefreshExpiredError(
            "OAuth refresh token is no longer valid. Please run 'ably login' again.",
          );
        }
      }
      throw new Error(
        `${operationName} failed (${response.status}): ${errorBody}`,
      );
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
 * Extract an error code + human message from a polling-endpoint error body.
 *
 * The OAuth-compliant shape per RFC 6749 §5.2 is `{error: "slow_down"}` with
 * an optional `error_description`. The website currently does NOT use this
 * shape for non-OAuth-specific failures (rate limits, 404s, etc.); it reuses
 * the Control API envelope `{error: {message, statusCode}}`. Observed in
 * practice: `statusCode` is a string (e.g. "429") and there is no `code`
 * field — but we still read `code` defensively in case the website is later
 * brought into line with the Control API's documented shape
 * `{error: {code, message, statusCode}}`.
 *
 * Never throws — parse failures degrade to undefined.
 */
async function parsePollingError(
  response: FetchResponse,
): Promise<{ code?: string; message?: string }> {
  let errorData: Record<string, unknown>;
  try {
    errorData = (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }

  const raw = errorData.error;
  if (typeof raw === "string") {
    return {
      code: raw,
      message:
        typeof errorData.error_description === "string"
          ? errorData.error_description
          : undefined,
    };
  }

  if (raw && typeof raw === "object") {
    const nested = raw as Record<string, unknown>;
    const stringify = (v: unknown) =>
      typeof v === "string" ? v : typeof v === "number" ? String(v) : undefined;
    // Prefer `code` if the website ever emits it, then fall back to
    // `statusCode` (what it actually emits today).
    const code = stringify(nested.code) ?? stringify(nested.statusCode);
    const message =
      typeof nested.message === "string" ? nested.message : undefined;
    return { code, message };
  }

  const topLevelMessage =
    typeof errorData.message === "string" ? errorData.message : undefined;
  return { message: topLevelMessage };
}
