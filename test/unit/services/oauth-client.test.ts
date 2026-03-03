import { describe, it, expect, afterEach } from "vitest";
import nock from "nock";
import fetch from "node-fetch";
import { OAuthClient } from "../../../src/services/oauth-client.js";
import {
  getErrorPage,
  getSuccessPage,
} from "../../../src/services/oauth-callback-page.js";

describe("OAuthClient", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  describe("PKCE generation", () => {
    it("generateCodeVerifier() returns a base64url string of expected length", () => {
      const client = new OAuthClient();
      const verifier = client.generateCodeVerifier();

      // 32 random bytes encoded as base64url produces ~43 characters
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(verifier.length).toBeGreaterThanOrEqual(40);
      expect(verifier.length).toBeLessThanOrEqual(50);
    });

    it("generateCodeChallenge() returns a base64url SHA256 hash", () => {
      const client = new OAuthClient();
      const verifier = "test-verifier-value";
      const challenge = client.generateCodeChallenge(verifier);

      // SHA256 digest as base64url is 43 characters
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(challenge.length).toBeGreaterThanOrEqual(40);
      expect(challenge.length).toBeLessThanOrEqual(50);
    });

    it("generateCodeChallenge() is deterministic for the same verifier", () => {
      const client = new OAuthClient();
      const verifier = "deterministic-test-verifier";
      const challenge1 = client.generateCodeChallenge(verifier);
      const challenge2 = client.generateCodeChallenge(verifier);

      expect(challenge1).toBe(challenge2);
    });

    it("generateCodeChallenge() produces different challenges for different verifiers", () => {
      const client = new OAuthClient();
      const challenge1 = client.generateCodeChallenge("verifier-one");
      const challenge2 = client.generateCodeChallenge("verifier-two");

      expect(challenge1).not.toBe(challenge2);
    });

    it("generateState() returns a base64url string of expected length", () => {
      const client = new OAuthClient();
      const state = client.generateState();

      // 16 random bytes encoded as base64url produces ~22 characters
      expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(state.length).toBeGreaterThanOrEqual(20);
      expect(state.length).toBeLessThanOrEqual(25);
    });
  });

  describe("OAuth config derivation", () => {
    it("default host uses https scheme", async () => {
      const client = new OAuthClient();

      const scope = nock("https://ably.com").post("/oauth/token").reply(200, {
        access_token: "new_access",
        expires_in: 3600,
        refresh_token: "new_refresh",
        scope: "full_access",
        token_type: "Bearer",
      });

      await client.refreshAccessToken("some_refresh_token");

      expect(scope.isDone()).toBe(true);
    });

    it("host containing 'local' uses http scheme", async () => {
      const client = new OAuthClient({ controlHost: "localhost:3000" });

      const scope = nock("http://localhost:3000")
        .post("/oauth/token")
        .reply(200, {
          access_token: "new_access",
          expires_in: 3600,
          refresh_token: "new_refresh",
          scope: "full_access",
          token_type: "Bearer",
        });

      await client.refreshAccessToken("some_refresh_token");

      expect(scope.isDone()).toBe(true);
    });

    it("client ID matches the expected value", () => {
      const client = new OAuthClient();
      expect(client.getClientId()).toBe(
        "_YfP7jQzCscq8nAxvx0CKPx9zKNx3vcdp0QEDNAAdow",
      );
    });
  });

  describe("refreshAccessToken", () => {
    it("returns OAuthTokens on successful refresh", async () => {
      const client = new OAuthClient();

      nock("https://ably.com").post("/oauth/token").reply(200, {
        access_token: "refreshed_access_token",
        expires_in: 7200,
        refresh_token: "refreshed_refresh_token",
        scope: "full_access",
        token_type: "Bearer",
      });

      const tokens = await client.refreshAccessToken("old_refresh_token");

      expect(tokens.accessToken).toBe("refreshed_access_token");
      expect(tokens.refreshToken).toBe("refreshed_refresh_token");
      expect(tokens.tokenType).toBe("Bearer");
      expect(tokens.scope).toBe("full_access");
      expect(tokens.expiresAt).toBeGreaterThan(Date.now());
    });

    it("throws on non-200 response with status and body", async () => {
      const client = new OAuthClient();

      nock("https://ably.com").post("/oauth/token").reply(401, "invalid_grant");

      await expect(
        client.refreshAccessToken("bad_refresh_token"),
      ).rejects.toThrow("Token refresh failed (401): invalid_grant");
    });

    it("sends correct form-encoded body", async () => {
      const client = new OAuthClient();
      const refreshToken = "my_refresh_token";

      const scope = nock("https://ably.com")
        .post("/oauth/token", (body: Record<string, string>) => {
          return (
            body.grant_type === "refresh_token" &&
            body.client_id === "_YfP7jQzCscq8nAxvx0CKPx9zKNx3vcdp0QEDNAAdow" &&
            body.refresh_token === refreshToken
          );
        })
        .reply(200, {
          access_token: "new_access",
          expires_in: 3600,
          refresh_token: "new_refresh",
          token_type: "Bearer",
        });

      await client.refreshAccessToken(refreshToken);

      expect(scope.isDone()).toBe(true);
    });
  });

  describe("revokeToken", () => {
    it("sends POST to revocation endpoint", async () => {
      const client = new OAuthClient();

      const scope = nock("https://ably.com").post("/oauth/revoke").reply(200);

      await client.revokeToken("token_to_revoke");

      expect(scope.isDone()).toBe(true);
    });

    it("does not throw on network error", async () => {
      const client = new OAuthClient();

      nock("https://ably.com")
        .post("/oauth/revoke")
        .replyWithError("Connection refused");

      // Should not throw
      await expect(
        client.revokeToken("token_to_revoke"),
      ).resolves.toBeUndefined();
    });
  });

  describe("login flow (callback server)", () => {
    it("completes login when callback receives valid code and state", async () => {
      const client = new OAuthClient();

      // Mock the token exchange endpoint
      nock("https://ably.com").post("/oauth/token").reply(200, {
        access_token: "login_access_token",
        expires_in: 3600,
        refresh_token: "login_refresh_token",
        scope: "full_access",
        token_type: "Bearer",
      });

      let capturedUrl = "";
      const tokens = await client.login(async (url) => {
        capturedUrl = url;

        // Extract state and redirect_uri from the authorization URL
        const parsed = new URL(url);
        const state = parsed.searchParams.get("state")!;
        const redirectUri = parsed.searchParams.get("redirect_uri")!;

        // Simulate browser callback with the correct state
        await fetch(`${redirectUri}?code=test_auth_code&state=${state}`);
      });

      expect(capturedUrl).toContain("oauth/authorize");
      expect(capturedUrl).toContain("code_challenge_method=S256");
      expect(capturedUrl).toContain("response_type=code");
      expect(tokens.accessToken).toBe("login_access_token");
      expect(tokens.refreshToken).toBe("login_refresh_token");
    });

    it("rejects when callback receives an error from the OAuth server", async () => {
      const client = new OAuthClient();

      await expect(
        client.login(async (url) => {
          const parsed = new URL(url);
          const redirectUri = parsed.searchParams.get("redirect_uri")!;

          await fetch(
            `${redirectUri}?error=access_denied&error_description=User+denied`,
          );
        }),
      ).rejects.toThrow("OAuth authorization failed: User denied");
    });

    it("rejects when callback has mismatched state", async () => {
      const client = new OAuthClient();

      await expect(
        client.login(async (url) => {
          const parsed = new URL(url);
          const redirectUri = parsed.searchParams.get("redirect_uri")!;

          await fetch(`${redirectUri}?code=test_code&state=wrong_state`);
        }),
      ).rejects.toThrow("Invalid OAuth callback");
    });

    it("rejects when token exchange fails", async () => {
      const client = new OAuthClient();

      nock("https://ably.com").post("/oauth/token").reply(400, "invalid_grant");

      await expect(
        client.login(async (url) => {
          const parsed = new URL(url);
          const state = parsed.searchParams.get("state")!;
          const redirectUri = parsed.searchParams.get("redirect_uri")!;

          await fetch(`${redirectUri}?code=bad_code&state=${state}`);
        }),
      ).rejects.toThrow("Token exchange failed (400)");
    });
  });

  describe("callback page HTML", () => {
    it("getSuccessPage returns HTML with success message", () => {
      const html = getSuccessPage();
      expect(html).toContain("Authentication Successful");
      expect(html).toContain("close this tab");
    });

    it("getErrorPage escapes HTML special characters to prevent XSS", () => {
      const malicious = '<script>alert("xss")</script>';
      const html = getErrorPage(malicious);

      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
      expect(html).toContain("&lt;/script&gt;");
      expect(html).toContain("Authentication Failed");
    });

    it("getErrorPage escapes ampersands and quotes", () => {
      const input = 'Error with "quotes" & <angles>';
      const html = getErrorPage(input);

      expect(html).toContain("&amp;");
      expect(html).toContain("&quot;quotes&quot;");
      expect(html).toContain("&lt;angles&gt;");
    });

    it("getErrorPage renders safe text unmodified", () => {
      const safeText = "Access was denied by the user";
      const html = getErrorPage(safeText);

      expect(html).toContain(safeText);
    });
  });
});
