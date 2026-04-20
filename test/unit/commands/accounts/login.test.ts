import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import {
  nockControl,
  controlApiCleanup,
} from "../../../helpers/control-api-test-helpers.js";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";
import { parseNdjsonLines } from "../../../helpers/ndjson.js";

const mockOAuthAccessToken = "oauth_access_token_12345";
const mockRefreshToken = "oauth_refresh_token_67890";

/**
 * Mock the OAuth device flow endpoints (device code + token polling).
 * The device code endpoint returns immediately, and the token endpoint
 * returns a successful token on the first poll.
 */
function mockOAuthDeviceFlow(host = "ably.com") {
  const scheme = host.includes("local") ? "http" : "https";

  nock(`${scheme}://${host}`)
    .post("/oauth/authorize_device")
    .reply(200, {
      device_code: "dc_test",
      expires_in: 300,
      interval: 0.01,
      user_code: "TEST-CODE",
      verification_uri: `${scheme}://${host}/device`,
      verification_uri_complete: `${scheme}://${host}/device?user_code=TEST-CODE`,
    });

  nock(`${scheme}://${host}`).post("/oauth/token").reply(200, {
    access_token: mockOAuthAccessToken,
    expires_in: 3600,
    refresh_token: mockRefreshToken,
    scope: "full_access",
    token_type: "Bearer",
  });
}

describe("accounts:login command", () => {
  const mockAccountId = "test-account-id";

  beforeEach(() => {
    controlApiCleanup();
    // Clear accounts so login tests start fresh
    const mock = getMockConfigManager();
    mock.clearAccounts();
  });

  afterEach(() => {
    controlApiCleanup();
  });

  standardHelpTests("accounts:login", import.meta.url);
  standardArgValidationTests("accounts:login", import.meta.url);

  describe("functionality", () => {
    it("should output JSON format when --json flag is used", async () => {
      mockOAuthDeviceFlow();

      // Mock the /me endpoint
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the /me/accounts endpoint
      nock("https://control.ably.net")
        .get("/v1/me/accounts")
        .reply(200, [{ id: mockAccountId, name: "Test Account" }]);

      // Mock the apps list endpoint
      nockControl().get(`/v1/accounts/${mockAccountId}/apps`).reply(200, []);

      const { stdout } = await runCommand(
        ["accounts:login", "--json"],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find((r) => r.type === "result")!;
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "accounts:login");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("account");
      const account = result.account as Record<string, unknown>;
      expect(account).toHaveProperty("id", mockAccountId);
      expect(account).toHaveProperty("name", "Test Account");
      expect(account).toHaveProperty("authMethod", "oauth");
      const user = account.user as Record<string, unknown>;
      expect(user).toHaveProperty("email", "test@example.com");

      // Verify config was updated correctly via mock
      const mock = getMockConfigManager();
      const config = mock.getConfig();
      expect(config.current?.account).toBe("test-account");
      expect(config.accounts["test-account"]).toBeDefined();
      expect(config.accounts["test-account"].accountId).toBe(mockAccountId);
      expect(config.accounts["test-account"].accountName).toBe("Test Account");
      expect(config.accounts["test-account"].authMethod).toBe("oauth");
      expect(config.accounts["test-account"].oauthSessionKey).toBeDefined();
      const session =
        config.oauthSessions?.[
          config.accounts["test-account"].oauthSessionKey!
        ];
      expect(session?.accessToken).toBe(mockOAuthAccessToken);
      expect(session?.refreshToken).toBe(mockRefreshToken);
      expect(session?.accessTokenExpiresAt).toBeDefined();
    });

    it("should include alias in JSON response when --alias flag is provided", async () => {
      const customAlias = "mycompany";
      mockOAuthDeviceFlow();

      // Mock the /me endpoint
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the /me/accounts endpoint
      nock("https://control.ably.net")
        .get("/v1/me/accounts")
        .reply(200, [{ id: mockAccountId, name: "Test Account" }]);

      // Mock the apps list endpoint
      nockControl().get(`/v1/accounts/${mockAccountId}/apps`).reply(200, []);

      const { stdout } = await runCommand(
        ["accounts:login", "--alias", customAlias, "--json"],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find((r) => r.type === "result")!;
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "accounts:login");
      expect(result).toHaveProperty("success", true);
      const account = result.account as Record<string, unknown>;
      expect(account).toHaveProperty("alias", customAlias);

      // Verify config was written with custom alias via mock
      const mock = getMockConfigManager();
      const config = mock.getConfig();
      expect(config.current?.account).toBe(customAlias);
      expect(config.accounts[customAlias]).toBeDefined();
      expect(config.accounts[customAlias].oauthSessionKey).toBeDefined();
      const session =
        config.oauthSessions?.[config.accounts[customAlias].oauthSessionKey!];
      expect(session?.accessToken).toBe(mockOAuthAccessToken);
      expect(config.accounts[customAlias].accountId).toBe(mockAccountId);
      expect(config.accounts[customAlias].accountName).toBe("Test Account");
    });

    it("should include app info when single app is auto-selected", async () => {
      const mockAppId = "app-123";
      const mockAppName = "My Only App";
      mockOAuthDeviceFlow();

      // Mock the /me endpoint twice - once for initial login, once for listApps
      nockControl()
        .get("/v1/me")
        .twice()
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the /me/accounts endpoint
      nock("https://control.ably.net")
        .get("/v1/me/accounts")
        .reply(200, [{ id: mockAccountId, name: "Test Account" }]);

      // Mock the apps list endpoint with single app
      nockControl()
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, [
          { id: mockAppId, name: mockAppName, accountId: mockAccountId },
        ]);

      const { stdout } = await runCommand(
        ["accounts:login", "--json"],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find((r) => r.type === "result")!;
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "accounts:login");
      expect(result).toHaveProperty("success", true);
      expect(result.account).toHaveProperty("app");
      expect(result.account.app).toHaveProperty("id", mockAppId);
      expect(result.account.app).toHaveProperty("name", mockAppName);
      expect(result.account.app).toHaveProperty("autoSelected", true);

      // Verify config was written with app info via mock
      const mock = getMockConfigManager();
      const config = mock.getConfig();
      expect(config.current?.account).toBe("test-account");
      expect(config.accounts["test-account"]).toBeDefined();
      expect(config.accounts["test-account"].oauthSessionKey).toBeDefined();
      const session =
        config.oauthSessions?.[
          config.accounts["test-account"].oauthSessionKey!
        ];
      expect(session?.accessToken).toBe(mockOAuthAccessToken);
      expect(config.accounts["test-account"].accountId).toBe(mockAccountId);
      expect(config.accounts["test-account"].currentAppId).toBe(mockAppId);
      expect(config.accounts["test-account"].apps?.[mockAppId]).toBeDefined();
      expect(config.accounts["test-account"].apps?.[mockAppId]?.appName).toBe(
        mockAppName,
      );
    });

    it("should not include app info when multiple apps exist (no interactive selection in JSON mode)", async () => {
      mockOAuthDeviceFlow();

      // Mock the /me endpoint twice - once for initial login, once for listApps
      nockControl()
        .get("/v1/me")
        .twice()
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the /me/accounts endpoint
      nock("https://control.ably.net")
        .get("/v1/me/accounts")
        .reply(200, [{ id: mockAccountId, name: "Test Account" }]);

      // Mock the apps list endpoint with multiple apps
      nockControl()
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, [
          { id: "app-1", name: "App 1", accountId: mockAccountId },
          { id: "app-2", name: "App 2", accountId: mockAccountId },
        ]);

      const { stdout } = await runCommand(
        ["accounts:login", "--json"],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find((r) => r.type === "result")!;
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "accounts:login");
      expect(result).toHaveProperty("success", true);
      expect(result.account).not.toHaveProperty("app");

      // Verify config was written without app selection via mock
      const mock = getMockConfigManager();
      const config = mock.getConfig();
      expect(config.current?.account).toBe("test-account");
      expect(config.accounts["test-account"]).toBeDefined();
      expect(config.accounts["test-account"].oauthSessionKey).toBeDefined();
      const session =
        config.oauthSessions?.[
          config.accounts["test-account"].oauthSessionKey!
        ];
      expect(session?.accessToken).toBe(mockOAuthAccessToken);
      expect(config.accounts["test-account"].accountId).toBe(mockAccountId);
      // Should NOT have currentAppId when multiple apps exist
      expect(config.accounts["test-account"].currentAppId).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("should output error in JSON format when authentication fails", async () => {
      mockOAuthDeviceFlow();

      // Mock authentication failure
      nockControl().get("/v1/me").reply(401, { error: "Unauthorized" });

      const { stdout } = await runCommand(
        ["accounts:login", "--json"],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find((r) => r.type === "error")!;
      expect(result).toHaveProperty("type", "error");
      expect(result).toHaveProperty("command", "accounts:login");
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
    });

    it("should output error in JSON format when network fails", async () => {
      mockOAuthDeviceFlow();

      // Mock network error for both endpoints called in parallel
      nockControl().get("/v1/me").replyWithError("Network error");
      nock("https://control.ably.net")
        .get("/v1/me/accounts")
        .replyWithError("Network error");

      const { stdout } = await runCommand(
        ["accounts:login", "--json"],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find((r) => r.type === "error")!;
      expect(result).toHaveProperty("type", "error");
      expect(result).toHaveProperty("command", "accounts:login");
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      expect(result.error.message).toContain("Network error");
    });

    it("should handle 500 server error", async () => {
      mockOAuthDeviceFlow();

      // Mock server error
      nockControl()
        .get("/v1/me")
        .reply(500, { error: "Internal Server Error" });

      const { stdout } = await runCommand(
        ["accounts:login", "--json"],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find((r) => r.type === "error")!;
      expect(result).toHaveProperty("type", "error");
      expect(result).toHaveProperty("command", "accounts:login");
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
    });

    it("should output error when OAuth device flow fails", async () => {
      // Mock device code request failure
      nock("https://ably.com")
        .post("/oauth/authorize_device")
        .reply(400, "invalid_client");

      const { stdout } = await runCommand(
        ["accounts:login", "--json"],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find((r) => r.type === "error")!;
      expect(result).toHaveProperty("type", "error");
      expect(result).toHaveProperty("command", "accounts:login");
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
    });

    it("should output error when authorization is denied", async () => {
      // Device code succeeds
      nock("https://ably.com").post("/oauth/authorize_device").reply(200, {
        device_code: "dc_denied",
        expires_in: 300,
        interval: 0.01,
        user_code: "DENY-CODE",
        verification_uri: "https://ably.com/device",
        verification_uri_complete:
          "https://ably.com/device?user_code=DENY-CODE",
      });

      // Token polling returns access_denied
      nock("https://ably.com")
        .post("/oauth/token")
        .reply(400, { error: "access_denied" });

      const { stdout } = await runCommand(
        ["accounts:login", "--json"],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find((r) => r.type === "error")!;
      expect(result).toHaveProperty("type", "error");
      expect(result).toHaveProperty("success", false);
      expect(result.error.message).toContain("Authorization denied");
    });
  });

  standardFlagTests("accounts:login", import.meta.url, ["--json"]);

  describe("custom hosts", () => {
    it("routes OAuth to --oauth-host and Control API to --control-host independently", async () => {
      // OAuth and Control API are distinct services; the CLI must target
      // them separately. Using a `control.` prefix on the control host
      // forces the /v1/ path; everything else uses /api/v1/.
      const oauthHost = "oauth.custom.ably.net";
      const controlHost = "control.custom.ably.net";

      mockOAuthDeviceFlow(oauthHost);

      // Mock the /me endpoint on the control host
      nock(`https://${controlHost}`)
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the /me/accounts endpoint on the control host
      nock(`https://${controlHost}`)
        .get("/v1/me/accounts")
        .reply(200, [{ id: mockAccountId, name: "Test Account" }]);

      // Mock the apps list endpoint on the control host
      nock(`https://${controlHost}`)
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, []);

      const { stdout } = await runCommand(
        [
          "accounts:login",
          "--oauth-host",
          oauthHost,
          "--control-host",
          controlHost,
          "--json",
        ],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find((r) => r.type === "result")!;
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "accounts:login");
      expect(result).toHaveProperty("success", true);
      const account = result.account as Record<string, unknown>;
      expect(account).toHaveProperty("id", mockAccountId);

      // Verify config was written correctly via mock
      const mock = getMockConfigManager();
      const config = mock.getConfig();
      expect(config.current?.account).toBe("test-account");
      expect(config.accounts["test-account"]).toBeDefined();
      expect(config.accounts["test-account"].oauthSessionKey).toBeDefined();
      const session =
        config.oauthSessions?.[
          config.accounts["test-account"].oauthSessionKey!
        ];
      expect(session?.accessToken).toBe(mockOAuthAccessToken);
      expect(config.accounts["test-account"].accountId).toBe(mockAccountId);
      expect(config.accounts["test-account"].accountName).toBe("Test Account");
    });
  });

  describe("OAuth device flow", () => {
    it("should show --no-browser flag in help output", async () => {
      const { stdout } = await runCommand(
        ["accounts:login", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--no-browser");
      expect(stdout).toContain("Do not open a browser");
    });

    it("should store OAuth tokens with authMethod, refreshToken, and expiresAt", async () => {
      mockOAuthDeviceFlow();

      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      nock("https://control.ably.net")
        .get("/v1/me/accounts")
        .reply(200, [{ id: mockAccountId, name: "Test Account" }]);

      nock("https://control.ably.net")
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, []);

      await runCommand(["accounts:login", "--json"], import.meta.url);

      const mock = getMockConfigManager();
      const config = mock.getConfig();
      expect(config.accounts["test-account"].authMethod).toBe("oauth");
      expect(config.accounts["test-account"].oauthSessionKey).toBeDefined();
      const session =
        config.oauthSessions?.[
          config.accounts["test-account"].oauthSessionKey!
        ];
      expect(session?.refreshToken).toBe(mockRefreshToken);
      expect(session?.accessTokenExpiresAt).toBeDefined();
      expect(session?.accessTokenExpiresAt).toBeGreaterThan(Date.now());
    });

    it("should emit awaiting_authorization event in JSON mode", async () => {
      mockOAuthDeviceFlow();

      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      nock("https://control.ably.net")
        .get("/v1/me/accounts")
        .reply(200, [{ id: mockAccountId, name: "Test Account" }]);

      nock("https://control.ably.net")
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, []);

      const { stdout } = await runCommand(
        ["accounts:login", "--json"],
        import.meta.url,
      );

      const events = parseNdjsonLines(stdout);
      const authEvent = events.find(
        (e) => e.status === "awaiting_authorization",
      );
      expect(authEvent).toBeDefined();
      expect(authEvent).toHaveProperty("userCode", "TEST-CODE");
      expect(authEvent).toHaveProperty("verificationUri");
    });
  });
});
