import { describe, it, expect, vi } from "vitest";
import {
  TokenRefreshMiddleware,
  TokenExpiredError,
} from "../../../src/services/token-refresh-middleware.js";

function createMockConfigManager(overrides: Record<string, unknown> = {}) {
  return {
    getAccessToken: vi.fn().mockReturnValue("current_access_token"),
    getAuthMethod: vi.fn(),
    getCurrentAccountAlias: vi.fn().mockReturnValue("default"),
    getOAuthTokens: vi.fn(),
    isAccessTokenExpired: vi.fn().mockReturnValue(false),
    storeOAuthTokens: vi.fn(),
    ...overrides,
  };
}

function createMockOAuthClient(overrides: Record<string, unknown> = {}) {
  return {
    refreshAccessToken: vi.fn(),
    ...overrides,
  };
}

describe("TokenRefreshMiddleware", () => {
  describe("non-OAuth passthrough", () => {
    it("returns access token as-is when authMethod is not oauth", async () => {
      const configManager = createMockConfigManager({
        getAuthMethod: vi.fn().mockReturnValue("token"),
        getAccessToken: vi.fn().mockReturnValue("legacy_token_value"),
      });
      const oauthClient = createMockOAuthClient();

      const middleware = new TokenRefreshMiddleware(
        configManager as never,
        oauthClient as never,
      );

      const token = await middleware.getValidAccessToken();

      expect(token).toBe("legacy_token_value");
      expect(oauthClient.refreshAccessToken).not.toHaveBeenCalled();
    });

    it("throws TokenExpiredError when no access token is found", async () => {
      const configManager = createMockConfigManager({
        getAuthMethod: vi.fn(),
        getAccessToken: vi.fn(),
      });
      const oauthClient = createMockOAuthClient();

      const middleware = new TokenRefreshMiddleware(
        configManager as never,
        oauthClient as never,
      );

      await expect(middleware.getValidAccessToken()).rejects.toThrow(
        TokenExpiredError,
      );
      await expect(middleware.getValidAccessToken()).rejects.toThrow(
        "No access token found",
      );
    });
  });

  describe("non-expired OAuth token", () => {
    it("returns current token without calling refresh when not expired", async () => {
      const configManager = createMockConfigManager({
        getAuthMethod: vi.fn().mockReturnValue("oauth"),
        getAccessToken: vi.fn().mockReturnValue("valid_oauth_token"),
        isAccessTokenExpired: vi.fn().mockReturnValue(false),
      });
      const oauthClient = createMockOAuthClient();

      const middleware = new TokenRefreshMiddleware(
        configManager as never,
        oauthClient as never,
      );

      const token = await middleware.getValidAccessToken();

      expect(token).toBe("valid_oauth_token");
      expect(oauthClient.refreshAccessToken).not.toHaveBeenCalled();
      expect(configManager.storeOAuthTokens).not.toHaveBeenCalled();
    });
  });

  describe("expired OAuth token", () => {
    it("refreshes token, stores new tokens, and returns new access token", async () => {
      const newTokens = {
        accessToken: "refreshed_access_token",
        expiresAt: Date.now() + 7200000,
        refreshToken: "refreshed_refresh_token",
        scope: "full_access",
        tokenType: "Bearer",
      };

      const configManager = createMockConfigManager({
        getAuthMethod: vi.fn().mockReturnValue("oauth"),
        getAccessToken: vi.fn().mockReturnValue("expired_oauth_token"),
        isAccessTokenExpired: vi.fn().mockReturnValue(true),
        getOAuthTokens: vi.fn().mockReturnValue({
          accessToken: "expired_oauth_token",
          refreshToken: "valid_refresh_token",
          expiresAt: Date.now() - 1000,
        }),
        getCurrentAccountAlias: vi.fn().mockReturnValue("default"),
      });
      const oauthClient = createMockOAuthClient({
        refreshAccessToken: vi.fn().mockResolvedValue(newTokens),
      });

      const middleware = new TokenRefreshMiddleware(
        configManager as never,
        oauthClient as never,
      );

      const token = await middleware.getValidAccessToken();

      expect(token).toBe("refreshed_access_token");
      expect(oauthClient.refreshAccessToken).toHaveBeenCalledWith(
        "valid_refresh_token",
      );
      expect(configManager.storeOAuthTokens).toHaveBeenCalledWith(
        "default",
        newTokens,
      );
    });
  });

  describe("missing refresh token", () => {
    it("throws TokenExpiredError when token is expired but no refresh token available", async () => {
      const configManager = createMockConfigManager({
        getAuthMethod: vi.fn().mockReturnValue("oauth"),
        getAccessToken: vi.fn().mockReturnValue("expired_token"),
        isAccessTokenExpired: vi.fn().mockReturnValue(true),
        getOAuthTokens: vi.fn(),
      });
      const oauthClient = createMockOAuthClient();

      const middleware = new TokenRefreshMiddleware(
        configManager as never,
        oauthClient as never,
      );

      await expect(middleware.getValidAccessToken()).rejects.toThrow(
        TokenExpiredError,
      );
      await expect(middleware.getValidAccessToken()).rejects.toThrow(
        "run 'ably login' again",
      );
    });
  });

  describe("refresh failure", () => {
    it("propagates error when refreshAccessToken throws", async () => {
      const configManager = createMockConfigManager({
        getAuthMethod: vi.fn().mockReturnValue("oauth"),
        getAccessToken: vi.fn().mockReturnValue("expired_token"),
        isAccessTokenExpired: vi.fn().mockReturnValue(true),
        getOAuthTokens: vi.fn().mockReturnValue({
          accessToken: "expired_token",
          refreshToken: "bad_refresh_token",
          expiresAt: Date.now() - 1000,
        }),
        getCurrentAccountAlias: vi.fn().mockReturnValue("default"),
      });
      const oauthClient = createMockOAuthClient({
        refreshAccessToken: vi
          .fn()
          .mockRejectedValue(
            new Error("Token refresh failed (401): invalid_grant"),
          ),
      });

      const middleware = new TokenRefreshMiddleware(
        configManager as never,
        oauthClient as never,
      );

      await expect(middleware.getValidAccessToken()).rejects.toThrow(
        "Token refresh failed (401): invalid_grant",
      );
    });
  });
});
