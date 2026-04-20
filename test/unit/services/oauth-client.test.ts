import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { OAuthClient } from "../../../src/services/oauth-client.js";

describe("OAuthClient", () => {
  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe("OAuth config derivation", () => {
    it("default host uses https scheme", async () => {
      const client = new OAuthClient();

      const scope = nock("https://ably.com")
        .post("/oauth/authorize_device")
        .reply(200, {
          device_code: "dc_test",
          expires_in: 300,
          interval: 5,
          user_code: "ABCD-1234",
          verification_uri: "https://ably.com/device",
          verification_uri_complete:
            "https://ably.com/device?user_code=ABCD-1234",
        });

      await client.requestDeviceCode();

      expect(scope.isDone()).toBe(true);
    });

    it("host containing 'local' uses http scheme", async () => {
      const client = new OAuthClient({ oauthHost: "localhost:3000" });

      const scope = nock("http://localhost:3000")
        .post("/oauth/authorize_device")
        .reply(200, {
          device_code: "dc_test",
          expires_in: 300,
          interval: 5,
          user_code: "ABCD-1234",
          verification_uri: "http://localhost:3000/device",
          verification_uri_complete:
            "http://localhost:3000/device?user_code=ABCD-1234",
        });

      await client.requestDeviceCode();

      expect(scope.isDone()).toBe(true);
    });

    it("client ID matches the expected value", () => {
      const client = new OAuthClient();
      expect(client.getClientId()).toBe(
        "gb-I8-bZRnXs-gF83jOWKQrUxPPWp_ldTfQtgGP0EFg",
      );
    });
  });

  describe("requestDeviceCode", () => {
    it("returns all fields from server response", async () => {
      const client = new OAuthClient();

      nock("https://ably.com").post("/oauth/authorize_device").reply(200, {
        device_code: "dc_abc123",
        expires_in: 600,
        interval: 10,
        user_code: "WXYZ-5678",
        verification_uri: "https://ably.com/device",
        verification_uri_complete:
          "https://ably.com/device?user_code=WXYZ-5678",
      });

      const result = await client.requestDeviceCode();

      expect(result.deviceCode).toBe("dc_abc123");
      expect(result.expiresIn).toBe(600);
      expect(result.interval).toBe(10);
      expect(result.userCode).toBe("WXYZ-5678");
      expect(result.verificationUri).toBe("https://ably.com/device");
      expect(result.verificationUriComplete).toBe(
        "https://ably.com/device?user_code=WXYZ-5678",
      );
    });

    it("sends correct client_id and scope in body", async () => {
      const client = new OAuthClient();

      const scope = nock("https://ably.com")
        .post(
          "/oauth/authorize_device",
          (body: Record<string, string>) =>
            body.client_id === "gb-I8-bZRnXs-gF83jOWKQrUxPPWp_ldTfQtgGP0EFg" &&
            body.scope === "full_access",
        )
        .reply(200, {
          device_code: "dc_test",
          expires_in: 300,
          interval: 5,
          user_code: "TEST-CODE",
          verification_uri: "https://ably.com/device",
          verification_uri_complete:
            "https://ably.com/device?user_code=TEST-CODE",
        });

      await client.requestDeviceCode();

      expect(scope.isDone()).toBe(true);
    });

    it("throws on non-200 response", async () => {
      const client = new OAuthClient();

      nock("https://ably.com")
        .post("/oauth/authorize_device")
        .reply(400, "invalid_client");

      await expect(client.requestDeviceCode()).rejects.toThrow(
        "Device code request failed (400): invalid_client",
      );
    });
  });

  describe("pollForToken", () => {
    it("returns tokens after authorization_pending then success", async () => {
      const client = new OAuthClient();

      // First call: authorization_pending
      nock("https://ably.com")
        .post("/oauth/token")
        .reply(400, { error: "authorization_pending" });

      // Second call: success
      nock("https://ably.com").post("/oauth/token").reply(200, {
        access_token: "at_device_flow",
        expires_in: 3600,
        refresh_token: "rt_device_flow",
        scope: "full_access",
        token_type: "Bearer",
      });

      const tokens = await client.pollForToken("dc_test", 0.01, 10);

      expect(tokens.accessToken).toBe("at_device_flow");
      expect(tokens.refreshToken).toBe("rt_device_flow");
      expect(tokens.tokenType).toBe("Bearer");
    });

    it("increases interval on slow_down", async () => {
      const client = new OAuthClient();

      // First call: slow_down (interval increases by 5s per RFC 8628)
      nock("https://ably.com")
        .post("/oauth/token")
        .reply(400, { error: "slow_down" });

      // Second call: success
      nock("https://ably.com").post("/oauth/token").reply(200, {
        access_token: "at_slow",
        expires_in: 3600,
        refresh_token: "rt_slow",
        token_type: "Bearer",
      });

      const tokens = await client.pollForToken("dc_test", 0.01, 30);

      expect(tokens.accessToken).toBe("at_slow");
    }, 15_000);

    it("throws on expired_token", async () => {
      const client = new OAuthClient();

      nock("https://ably.com")
        .post("/oauth/token")
        .reply(400, { error: "expired_token" });

      await expect(client.pollForToken("dc_test", 0.01, 10)).rejects.toThrow(
        "Device code expired",
      );
    });

    it("throws on access_denied", async () => {
      const client = new OAuthClient();

      nock("https://ably.com")
        .post("/oauth/token")
        .reply(400, { error: "access_denied" });

      await expect(client.pollForToken("dc_test", 0.01, 10)).rejects.toThrow(
        "Authorization denied",
      );
    });

    it("sends correct grant_type and device_code", async () => {
      const client = new OAuthClient();

      const scope = nock("https://ably.com")
        .post("/oauth/token", (body: Record<string, string>) => {
          return (
            body.grant_type ===
              "urn:ietf:params:oauth:grant-type:device_code" &&
            body.device_code === "dc_verify" &&
            body.client_id === "gb-I8-bZRnXs-gF83jOWKQrUxPPWp_ldTfQtgGP0EFg"
          );
        })
        .reply(200, {
          access_token: "at_verify",
          expires_in: 3600,
          refresh_token: "rt_verify",
          token_type: "Bearer",
        });

      await client.pollForToken("dc_verify", 0.01, 10);

      expect(scope.isDone()).toBe(true);
    });

    it("throws after deadline exceeded", async () => {
      const client = new OAuthClient();

      // Keep returning authorization_pending; the deadline will expire
      nock("https://ably.com")
        .post("/oauth/token")
        .times(10)
        .reply(400, { error: "authorization_pending" });

      // Use a very short expiresIn so the deadline passes quickly
      await expect(
        client.pollForToken("dc_expired", 0.01, 0.05),
      ).rejects.toThrow("Device code expired");
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

    it("throws OAuthRefreshExpiredError on invalid_grant", async () => {
      const client = new OAuthClient();

      nock("https://ably.com").post("/oauth/token").reply(400, {
        error: "invalid_grant",
        error_description: "The refresh token is invalid.",
      });

      await expect(
        client.refreshAccessToken("bad_refresh_token"),
      ).rejects.toThrow(/OAuth refresh token is no longer valid/);
    });

    it("surfaces error_description on other OAuth errors", async () => {
      const client = new OAuthClient();

      nock("https://ably.com").post("/oauth/token").reply(400, {
        error: "invalid_request",
        error_description: "The refresh_token parameter is missing.",
      });

      await expect(
        client.refreshAccessToken("bad_refresh_token"),
      ).rejects.toThrow(
        /Token refresh failed: The refresh_token parameter is missing\./,
      );
    });

    it("falls back to HTTP status when body is unparseable", async () => {
      const client = new OAuthClient();

      nock("https://ably.com").post("/oauth/token").reply(500, "upstream down");

      await expect(
        client.refreshAccessToken("bad_refresh_token"),
      ).rejects.toThrow(/Token refresh failed: HTTP 500/);
    });

    it("sends correct form-encoded body", async () => {
      const client = new OAuthClient();
      const refreshToken = "my_refresh_token";

      const scope = nock("https://ably.com")
        .post("/oauth/token", (body: Record<string, string>) => {
          return (
            body.grant_type === "refresh_token" &&
            body.client_id === "gb-I8-bZRnXs-gF83jOWKQrUxPPWp_ldTfQtgGP0EFg" &&
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

    it("preserves existing refresh token when response omits refresh_token", async () => {
      const client = new OAuthClient();

      // Response omits refresh_token (allowed by RFC 6749 §5.1)
      nock("https://ably.com").post("/oauth/token").reply(200, {
        access_token: "new_access_token",
        expires_in: 3600,
        token_type: "Bearer",
      });

      const tokens = await client.refreshAccessToken("existing_refresh_token");

      expect(tokens.accessToken).toBe("new_access_token");
      expect(tokens.refreshToken).toBe("existing_refresh_token");
    });

    it("throws when response missing both access_token and refresh_token", async () => {
      const client = new OAuthClient();

      nock("https://ably.com").post("/oauth/token").reply(200, {
        token_type: "Bearer",
        expires_in: 3600,
      });

      await expect(
        client.refreshAccessToken("some_refresh_token"),
      ).rejects.toThrow("Token response missing required fields");
    });
  });

  describe("revokeToken", () => {
    it("sends POST to revocation endpoint", async () => {
      const client = new OAuthClient();

      const scope = nock("https://ably.com").post("/oauth/revoke").reply(200);

      await client.revokeToken("token_to_revoke");

      expect(scope.isDone()).toBe(true);
    });

    it("throws on network error so the caller can report it", async () => {
      const client = new OAuthClient();

      nock("https://ably.com")
        .post("/oauth/revoke")
        .replyWithError("Connection refused");

      await expect(client.revokeToken("token_to_revoke")).rejects.toThrow();
    });

    it("throws on non-2xx response", async () => {
      const client = new OAuthClient();

      nock("https://ably.com")
        .post("/oauth/revoke")
        .reply(500, "internal_error");

      await expect(client.revokeToken("token_to_revoke")).rejects.toThrow(
        /Token revocation failed \(500\)/,
      );
    });

    it("rejects when external AbortSignal is aborted", async () => {
      const client = new OAuthClient();

      // Never responds — ensures the abort is what ends the request.
      nock("https://ably.com").post("/oauth/revoke").delay(10_000).reply(200);

      const controller = new AbortController();
      const promise = client.revokeToken("token_to_revoke", {
        signal: controller.signal,
      });
      // Abort after the fetch is in flight.
      setTimeout(() => controller.abort(), 20);

      await expect(promise).rejects.toThrow();
    });
  });

  describe("pollForToken error handling", () => {
    it("backs off on rate_limited (429) and eventually succeeds", async () => {
      const client = new OAuthClient();

      // First call: 429 with RFC 6749 §5.2 flat body + Retry-After header,
      // matching what the website now emits (see website PR #7962).
      nock("https://ably.com").post("/oauth/token").reply(
        429,
        {
          error: "rate_limited",
          error_description: "Rate limit exceeded. Retry after 1 second.",
        },
        { "Retry-After": "1" },
      );

      nock("https://ably.com").post("/oauth/token").reply(200, {
        access_token: "at_after_429",
        expires_in: 3600,
        refresh_token: "rt_after_429",
        token_type: "Bearer",
      });

      const tokens = await client.pollForToken("dc_429", 0.01, 30);
      expect(tokens.accessToken).toBe("at_after_429");
    }, 15_000);

    it("surfaces error_description on unknown error codes", async () => {
      const client = new OAuthClient();

      nock("https://ably.com").post("/oauth/token").reply(400, {
        error: "invalid_request",
        error_description: "The device_code parameter is malformed.",
      });

      await expect(client.pollForToken("dc_obj", 0.01, 10)).rejects.toThrow(
        /Token polling failed: The device_code parameter is malformed\./,
      );
    });

    it("falls back to the error code when no description is provided", async () => {
      const client = new OAuthClient();

      nock("https://ably.com")
        .post("/oauth/token")
        .reply(400, { error: "invalid_request" });

      await expect(client.pollForToken("dc_obj", 0.01, 10)).rejects.toThrow(
        /Token polling failed: invalid_request/,
      );
    });

    it("falls back to HTTP status when the body is not parseable", async () => {
      const client = new OAuthClient();

      nock("https://ably.com")
        .post("/oauth/token")
        .reply(500, "<html>upstream error</html>");

      await expect(client.pollForToken("dc_obj", 0.01, 10)).rejects.toThrow(
        /Token polling failed: HTTP 500/,
      );
    });
  });

  describe("pollForToken abort signal", () => {
    it("rejects promptly when the signal is aborted mid-sleep", async () => {
      const client = new OAuthClient();
      const controller = new AbortController();

      // A long interval (10s) guarantees we're in the sleep, not the fetch,
      // when the signal fires.
      const promise = client.pollForToken(
        "dc_abort_sleep",
        10,
        60,
        controller.signal,
      );
      setTimeout(() => controller.abort(), 20);

      await expect(promise).rejects.toThrow(/aborted/i);
    }, 2_000);

    it("rejects promptly when the signal is aborted during a fetch", async () => {
      const client = new OAuthClient();
      const controller = new AbortController();

      // The endpoint never responds, so without the abort the request would
      // hit pollForToken's internal 15s fetch timeout instead.
      nock("https://ably.com").post("/oauth/token").delay(10_000).reply(200);

      const promise = client.pollForToken(
        "dc_abort_fetch",
        0.01,
        60,
        controller.signal,
      );
      setTimeout(() => controller.abort(), 100);

      await expect(promise).rejects.toThrow(/aborted/i);
    }, 5_000);

    it("rejects immediately when the signal is already aborted", async () => {
      const client = new OAuthClient();
      const controller = new AbortController();
      controller.abort();

      await expect(
        client.pollForToken("dc_pre_aborted", 1, 60, controller.signal),
      ).rejects.toThrow(/aborted/i);
    });
  });
});
