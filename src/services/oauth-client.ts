import fetch from "node-fetch";

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
  controlHost?: string;
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
    this.config = this.getOAuthConfig(options.controlHost);
  }

  /**
   * Request a device code from the OAuth server (RFC 8628 step 1).
   */
  async requestDeviceCode(): Promise<DeviceCodeResponse> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      scope: this.config.scopes.join(" "),
    });

    const response = await fetch(this.config.deviceCodeEndpoint, {
      body: params.toString(),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    });

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
      await this.sleep(currentInterval * 1000);

      if (Date.now() >= deadline) {
        throw new Error("Device code expired");
      }

      let response;
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
      }

      if (response.ok) {
        const data = (await response.json()) as Record<string, unknown>;
        return this.parseTokenResponse(data);
      }

      let error: string;
      try {
        const errorData = (await response.json()) as Record<string, unknown>;
        error = errorData.error as string;
      } catch {
        throw new Error(`Token polling failed with status ${response.status}`);
      }

      if (error === "authorization_pending") {
        continue;
      }

      if (error === "slow_down") {
        currentInterval += 5;
        continue;
      }

      if (error === "expired_token") {
        throw new Error("Device code expired");
      }

      if (error === "access_denied") {
        throw new Error("Authorization denied");
      }

      throw new Error(`Token polling failed: ${error}`);
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
   * Revoke a token (access or refresh)
   */
  async revokeToken(token: string): Promise<void> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      token,
    });

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      await fetch(this.config.revocationEndpoint, {
        body: params.toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        method: "POST",
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch {
      // Best-effort revocation -- don't block on failure
    }
  }

  getClientId(): string {
    return this.config.clientId;
  }

  // --- Private helpers ---

  private getOAuthConfig(controlHost = "ably.com"): OAuthConfig {
    const host = controlHost;
    const scheme = host.includes("local") ? "http" : "https";
    return {
      clientId: "gb-I8-bZRnXs-gF83jOWKQrUxPPWp_ldTfQtgGP0EFg",
      deviceCodeEndpoint: `${scheme}://${host}/oauth/authorize_device`,
      revocationEndpoint: `${scheme}://${host}/oauth/revoke`,
      scopes: ["full_access"],
      tokenEndpoint: `${scheme}://${host}/oauth/token`,
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
    const response = await fetch(this.config.tokenEndpoint, {
      body: body.toString(),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text();
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
