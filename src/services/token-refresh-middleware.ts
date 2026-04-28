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

    const consumedRefreshToken = tokens.refreshToken;
    let newTokens: OAuthTokens;
    try {
      newTokens =
        await this.oauthClient.refreshAccessToken(consumedRefreshToken);
    } catch (error) {
      // invalid_grant typically means another CLI invocation already rotated
      // this refresh token, or the session was revoked server-side. Before
      // clearing the session, reload the on-disk config: a concurrent peer
      // may have just rotated the token and persisted a fresh refresh token.
      // Clobbering that by saving our stale in-memory view would destroy a
      // valid session, turning a single-process failure into a fleet-wide
      // "please re-login" for every invocation.
      if (error instanceof OAuthRefreshExpiredError) {
        this.configManager.reloadConfig();
        const onDisk = this.configManager.getOAuthTokens();
        // Only clear when disk still holds the refresh token we just tried
        // (or the session is already gone). A different refresh token on
        // disk means a peer rotated it successfully — their session is
        // valid and must be preserved.
        if (!onDisk || onDisk.refreshToken === consumedRefreshToken) {
          this.configManager.clearOAuthSession();
        }
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
