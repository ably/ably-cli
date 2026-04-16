import type { ConfigManager } from "./config-manager.js";
import type { OAuthClient, OAuthTokens } from "./oauth-client.js";
import { OAuthRefreshExpiredError } from "./oauth-client.js";

export class TokenExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenExpiredError";
  }
}

export class TokenRefreshMiddleware {
  private pendingRefresh: Promise<string> | undefined;

  constructor(
    private configManager: ConfigManager,
    private oauthClient: OAuthClient,
  ) {}

  async getValidAccessToken(): Promise<string> {
    const authMethod = this.configManager.getAuthMethod();

    // Non-OAuth tokens: return as-is
    if (authMethod !== "oauth") {
      const token = this.configManager.getAccessToken();
      if (!token)
        throw new TokenExpiredError(
          "No access token found. Please run 'ably login'.",
        );
      return token;
    }

    // Not expired: return current token
    if (!this.configManager.isAccessTokenExpired()) {
      const token = this.configManager.getAccessToken();
      if (token) return token;
    }

    // Expired: refresh using refresh token (deduplicate concurrent calls)
    if (this.pendingRefresh) {
      return this.pendingRefresh;
    }

    this.pendingRefresh = this.refreshToken();
    try {
      return await this.pendingRefresh;
    } finally {
      this.pendingRefresh = undefined;
    }
  }

  private async refreshToken(): Promise<string> {
    const tokens = this.configManager.getOAuthTokens();
    if (!tokens?.refreshToken) {
      throw new TokenExpiredError(
        "OAuth session expired. Please run 'ably login' again.",
      );
    }

    let newTokens: OAuthTokens;
    try {
      newTokens = await this.oauthClient.refreshAccessToken(
        tokens.refreshToken,
      );
    } catch (error) {
      // invalid_grant typically means another CLI invocation already rotated
      // this refresh token, or the session was revoked server-side. Clear
      // the dead session so subsequent commands short-circuit to "please
      // re-login" immediately instead of re-attempting refresh.
      if (error instanceof OAuthRefreshExpiredError) {
        this.configManager.clearOAuthSession();
        throw new TokenExpiredError(
          "OAuth session expired (the refresh token is no longer valid, possibly because another CLI invocation refreshed concurrently). Please run 'ably login' again.",
        );
      }
      throw error;
    }
    const alias = this.configManager.getCurrentAccountAlias() || "default";
    this.configManager.storeOAuthTokens(alias, newTokens);
    return newTokens.accessToken;
  }
}
