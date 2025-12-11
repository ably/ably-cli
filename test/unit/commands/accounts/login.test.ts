import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { resolve } from "node:path";
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";

describe("accounts:login command", () => {
  const mockAccessToken = "test_access_token_12345";
  const mockAccountId = "test-account-id";
  let testConfigDir: string;
  let originalConfigDir: string;

  beforeEach(() => {
    nock.cleanAll();

    // Create a temporary config directory for testing
    testConfigDir = resolve(tmpdir(), `ably-cli-test-login-${Date.now()}`);
    mkdirSync(testConfigDir, { recursive: true, mode: 0o700 });

    // Store original config dir and set test config dir
    originalConfigDir = process.env.ABLY_CLI_CONFIG_DIR || "";
    process.env.ABLY_CLI_CONFIG_DIR = testConfigDir;

    // Create a minimal config file
    const configContent = `[current]
account = "default"
`;
    writeFileSync(resolve(testConfigDir, "config"), configContent);
  });

  afterEach(() => {
    nock.cleanAll();

    // Restore original config directory
    if (originalConfigDir) {
      process.env.ABLY_CLI_CONFIG_DIR = originalConfigDir;
    } else {
      delete process.env.ABLY_CLI_CONFIG_DIR;
    }

    // Clean up test config directory
    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
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

      // Verify config file was written correctly
      const configContent = readFileSync(
        resolve(testConfigDir, "config"),
        "utf8",
      );
      expect(configContent).toContain("[current]");
      expect(configContent).toContain('account = "default"');
      expect(configContent).toContain("[accounts.default]");
      expect(configContent).toContain(`accessToken = "${mockAccessToken}"`);
      expect(configContent).toContain(`accountId = "${mockAccountId}"`);
      expect(configContent).toContain('accountName = "Test Account"');
      expect(configContent).toContain('userEmail = "test@example.com"');
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

      // Verify config file was written with custom alias
      const configContent = readFileSync(
        resolve(testConfigDir, "config"),
        "utf8",
      );
      expect(configContent).toContain("[current]");
      expect(configContent).toContain(`account = "${customAlias}"`);
      expect(configContent).toContain(`[accounts.${customAlias}]`);
      expect(configContent).toContain(`accessToken = "${mockAccessToken}"`);
      expect(configContent).toContain(`accountId = "${mockAccountId}"`);
      expect(configContent).toContain('accountName = "Test Account"');
      expect(configContent).toContain('userEmail = "test@example.com"');
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

      // Verify config file was written with app info
      const configContent = readFileSync(
        resolve(testConfigDir, "config"),
        "utf8",
      );
      expect(configContent).toContain("[current]");
      expect(configContent).toContain('account = "default"');
      expect(configContent).toContain("[accounts.default]");
      expect(configContent).toContain(`accessToken = "${mockAccessToken}"`);
      expect(configContent).toContain(`accountId = "${mockAccountId}"`);
      expect(configContent).toContain(`currentAppId = "${mockAppId}"`);
      expect(configContent).toContain(`[accounts.default.apps.${mockAppId}]`);
      expect(configContent).toContain(`appName = "${mockAppName}"`);
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

      // Verify config file was written without app selection
      const configContent = readFileSync(
        resolve(testConfigDir, "config"),
        "utf8",
      );
      expect(configContent).toContain("[current]");
      expect(configContent).toContain('account = "default"');
      expect(configContent).toContain("[accounts.default]");
      expect(configContent).toContain(`accessToken = "${mockAccessToken}"`);
      expect(configContent).toContain(`accountId = "${mockAccountId}"`);
      // Should NOT contain currentAppId when multiple apps exist
      expect(configContent).not.toContain("currentAppId");
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

      // Verify config file was written with custom control host in mind
      // (the account should still be stored correctly)
      const configContent = readFileSync(
        resolve(testConfigDir, "config"),
        "utf8",
      );
      expect(configContent).toContain("[current]");
      expect(configContent).toContain('account = "default"');
      expect(configContent).toContain("[accounts.default]");
      expect(configContent).toContain(`accessToken = "${mockAccessToken}"`);
      expect(configContent).toContain(`accountId = "${mockAccountId}"`);
      expect(configContent).toContain('accountName = "Test Account"');
      expect(configContent).toContain('userEmail = "test@example.com"');
    });
  });
});
