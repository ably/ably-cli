import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";

describe("accounts:login command", () => {
  const mockAccessToken = "test_access_token_12345";
  const mockAccountId = "test-account-id";

  beforeEach(() => {
    nock.cleanAll();
    // Clear accounts so login tests start fresh
    const mock = getMockConfigManager();
    mock.clearAccounts();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["accounts:login", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Log in to your Ably account");
      expect(stdout).toContain("USAGE");
      expect(stdout).toContain("--alias");
      expect(stdout).toContain("--no-browser");
    });

    it("should display examples in help", async () => {
      const { stdout } = await runCommand(
        ["accounts:login", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("EXAMPLES");
      expect(stdout).toContain("accounts login");
    });
  });

  describe("with token argument and --json flag", () => {
    it("should output JSON format when --json flag is used", async () => {
      // Mock the /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the apps list endpoint
      nock("https://control.ably.net")
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, []);

      const { stdout } = await runCommand(
        ["accounts:login", mockAccessToken, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("account");
      expect(result.account).toHaveProperty("id", mockAccountId);
      expect(result.account).toHaveProperty("name", "Test Account");
      expect(result.account.user).toHaveProperty("email", "test@example.com");

      // Verify config was updated correctly via mock
      const mock = getMockConfigManager();
      const config = mock.getConfig();
      expect(config.current?.account).toBe("default");
      expect(config.accounts["default"]).toBeDefined();
      expect(config.accounts["default"].accessToken).toBe(mockAccessToken);
      expect(config.accounts["default"].accountId).toBe(mockAccountId);
      expect(config.accounts["default"].accountName).toBe("Test Account");
      expect(config.accounts["default"].userEmail).toBe("test@example.com");
    });

    it("should include alias in JSON response when --alias flag is provided", async () => {
      const customAlias = "mycompany";

      // Mock the /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the apps list endpoint
      nock("https://control.ably.net")
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, []);

      const { stdout } = await runCommand(
        ["accounts:login", mockAccessToken, "--alias", customAlias, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result.account).toHaveProperty("alias", customAlias);

      // Verify config was written with custom alias via mock
      const mock = getMockConfigManager();
      const config = mock.getConfig();
      expect(config.current?.account).toBe(customAlias);
      expect(config.accounts[customAlias]).toBeDefined();
      expect(config.accounts[customAlias].accessToken).toBe(mockAccessToken);
      expect(config.accounts[customAlias].accountId).toBe(mockAccountId);
      expect(config.accounts[customAlias].accountName).toBe("Test Account");
      expect(config.accounts[customAlias].userEmail).toBe("test@example.com");
    });

    it("should include app info when single app is auto-selected", async () => {
      const mockAppId = "app-123";
      const mockAppName = "My Only App";

      // Mock the /me endpoint twice - once for initial login, once for listApps
      nock("https://control.ably.net")
        .get("/v1/me")
        .twice()
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the apps list endpoint with single app
      nock("https://control.ably.net")
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, [
          { id: mockAppId, name: mockAppName, accountId: mockAccountId },
        ]);

      const { stdout } = await runCommand(
        ["accounts:login", mockAccessToken, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("app");
      expect(result.app).toHaveProperty("id", mockAppId);
      expect(result.app).toHaveProperty("name", mockAppName);
      expect(result.app).toHaveProperty("autoSelected", true);

      // Verify config was written with app info via mock
      const mock = getMockConfigManager();
      const config = mock.getConfig();
      expect(config.current?.account).toBe("default");
      expect(config.accounts["default"]).toBeDefined();
      expect(config.accounts["default"].accessToken).toBe(mockAccessToken);
      expect(config.accounts["default"].accountId).toBe(mockAccountId);
      expect(config.accounts["default"].currentAppId).toBe(mockAppId);
      expect(config.accounts["default"].apps?.[mockAppId]).toBeDefined();
      expect(config.accounts["default"].apps?.[mockAppId]?.appName).toBe(
        mockAppName,
      );
    });

    it("should not include app info when multiple apps exist (no interactive selection in JSON mode)", async () => {
      // Mock the /me endpoint twice - once for initial login, once for listApps
      nock("https://control.ably.net")
        .get("/v1/me")
        .twice()
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the apps list endpoint with multiple apps
      nock("https://control.ably.net")
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, [
          { id: "app-1", name: "App 1", accountId: mockAccountId },
          { id: "app-2", name: "App 2", accountId: mockAccountId },
        ]);

      const { stdout } = await runCommand(
        ["accounts:login", mockAccessToken, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).not.toHaveProperty("app");

      // Verify config was written without app selection via mock
      const mock = getMockConfigManager();
      const config = mock.getConfig();
      expect(config.current?.account).toBe("default");
      expect(config.accounts["default"]).toBeDefined();
      expect(config.accounts["default"].accessToken).toBe(mockAccessToken);
      expect(config.accounts["default"].accountId).toBe(mockAccountId);
      // Should NOT have currentAppId when multiple apps exist
      expect(config.accounts["default"].currentAppId).toBeUndefined();
    });
  });

  describe("error handling with --json flag", () => {
    it("should output error in JSON format when authentication fails", async () => {
      // Mock authentication failure
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(401, { error: "Unauthorized" });

      const { stdout } = await runCommand(
        ["accounts:login", "invalid_token", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
    });

    it("should output error in JSON format when network fails", async () => {
      // Mock network error
      nock("https://control.ably.net")
        .get("/v1/me")
        .replyWithError("Network error");

      const { stdout } = await runCommand(
        ["accounts:login", mockAccessToken, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      expect(result.error).toContain("Network error");
    });

    it("should handle 500 server error", async () => {
      // Mock server error
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(500, { error: "Internal Server Error" });

      const { stdout } = await runCommand(
        ["accounts:login", mockAccessToken, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
    });
  });

  describe("custom control host", () => {
    it("should use custom control host when --control-host flag is provided", async () => {
      const customHost = "custom.ably.net";

      // Mock the /me endpoint on custom host
      nock(`https://${customHost}`)
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the apps list endpoint on custom host
      nock(`https://${customHost}`)
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, []);

      const { stdout } = await runCommand(
        [
          "accounts:login",
          mockAccessToken,
          "--control-host",
          customHost,
          "--json",
        ],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result.account).toHaveProperty("id", mockAccountId);

      // Verify config was written correctly via mock
      const mock = getMockConfigManager();
      const config = mock.getConfig();
      expect(config.current?.account).toBe("default");
      expect(config.accounts["default"]).toBeDefined();
      expect(config.accounts["default"].accessToken).toBe(mockAccessToken);
      expect(config.accounts["default"].accountId).toBe(mockAccountId);
      expect(config.accounts["default"].accountName).toBe("Test Account");
      expect(config.accounts["default"].userEmail).toBe("test@example.com");
    });
  });
});
