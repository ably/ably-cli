import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

describe("config:show command", () => {
  const mockAccessToken = "fake_access_token";
  const mockAccountId = "test-account-id";
  const mockAppId = "550e8400-e29b-41d4-a716-446655440000";
  const mockApiKey = `${mockAppId}.testkey:testsecret`;
  let testConfigDir: string;
  let originalConfigDir: string;

  beforeEach(() => {
    process.env.ABLY_ACCESS_TOKEN = mockAccessToken;

    testConfigDir = resolve(tmpdir(), `ably-cli-test-${Date.now()}`);
    mkdirSync(testConfigDir, { recursive: true, mode: 0o700 });

    originalConfigDir = process.env.ABLY_CLI_CONFIG_DIR || "";
    process.env.ABLY_CLI_CONFIG_DIR = testConfigDir;
  });

  afterEach(() => {
    delete process.env.ABLY_ACCESS_TOKEN;

    if (originalConfigDir) {
      process.env.ABLY_CLI_CONFIG_DIR = originalConfigDir;
    } else {
      delete process.env.ABLY_CLI_CONFIG_DIR;
    }

    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe("when config file exists", () => {
    beforeEach(() => {
      const configContent = `[current]
account = "default"

[accounts.default]
accessToken = "${mockAccessToken}"
accountId = "${mockAccountId}"
accountName = "Test Account"
userEmail = "test@example.com"
currentAppId = "${mockAppId}"

[accounts.default.apps."${mockAppId}"]
appName = "Test App"
apiKey = "${mockApiKey}"
`;
      writeFileSync(resolve(testConfigDir, "config"), configContent);
    });

    it("should display config file contents", async () => {
      const { stdout } = await runCommand(["config:show"], import.meta.url);

      expect(stdout).toContain("Config file:");
      expect(stdout).toContain("[current]");
      expect(stdout).toContain('account = "default"');
      expect(stdout).toContain("[accounts.default]");
      expect(stdout).toContain(`accessToken = "${mockAccessToken}"`);
      expect(stdout).toContain(`accountId = "${mockAccountId}"`);
    });

    it("should show config file path", async () => {
      const { stdout } = await runCommand(["config:show"], import.meta.url);

      expect(stdout).toContain(`# Config file: ${testConfigDir}`);
    });

    it("should output JSON format when --json flag is used", async () => {
      const { stdout } = await runCommand(
        ["config:show", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("exists", true);
      expect(result).toHaveProperty("path");
      expect(result.path).toContain(testConfigDir);
      expect(result).toHaveProperty("config");
      expect(result.config).toHaveProperty("current");
      expect(result.config.current).toHaveProperty("account", "default");
    });

    it("should output pretty JSON when --pretty-json flag is used", async () => {
      const { stdout } = await runCommand(
        ["config:show", "--pretty-json"],
        import.meta.url,
      );

      // Pretty JSON should have newlines and indentation
      expect(stdout).toContain("\n");
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("exists", true);
      expect(result).toHaveProperty("config");
    });

    it("should include accounts in JSON output", async () => {
      const { stdout } = await runCommand(
        ["config:show", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result.config).toHaveProperty("accounts");
      expect(result.config.accounts).toHaveProperty("default");
      expect(result.config.accounts.default).toHaveProperty(
        "accessToken",
        mockAccessToken,
      );
      expect(result.config.accounts.default).toHaveProperty(
        "accountId",
        mockAccountId,
      );
    });

    it("should include apps configuration in JSON output", async () => {
      const { stdout } = await runCommand(
        ["config:show", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result.config.accounts.default).toHaveProperty("apps");
      expect(result.config.accounts.default.apps).toHaveProperty(mockAppId);
      expect(result.config.accounts.default.apps[mockAppId]).toHaveProperty(
        "appName",
        "Test App",
      );
    });
  });

  describe("when config file does not exist", () => {
    it("should show error message", async () => {
      const { error } = await runCommand(["config:show"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Config file does not exist/i);
      expect(error?.message).toMatch(/ably accounts login/i);
    });

    it("should output JSON error when --json flag is used", async () => {
      const { stdout } = await runCommand(
        ["config:show", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("error");
      expect(result.error).toMatch(/Config file does not exist/i);
      expect(result).toHaveProperty("path");
    });
  });

  describe("with malformed config file", () => {
    it("should report error when config file has invalid TOML", async () => {
      // Write truly invalid TOML that definitely can't be parsed
      // Note: The ConfigManager will fail to load this before config:show can display it
      const invalidConfig = "[[[this is definitely not valid TOML";
      writeFileSync(resolve(testConfigDir, "config"), invalidConfig);

      const { error } = await runCommand(
        ["config:show", "--json"],
        import.meta.url,
      );

      // ConfigManager fails to load invalid TOML
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Failed to load|SyntaxError|parse/i);
    });

    it("should display valid TOML contents in text mode", async () => {
      // Write valid TOML with a proper quoted value
      const simpleConfig = '[section]\nkey = "value"';
      writeFileSync(resolve(testConfigDir, "config"), simpleConfig);

      const { stdout } = await runCommand(["config:show"], import.meta.url);

      expect(stdout).toContain("[section]");
      expect(stdout).toContain('key = "value"');
    });
  });

  describe("command arguments and flags", () => {
    beforeEach(() => {
      const configContent = `[current]\naccount = "default"`;
      writeFileSync(resolve(testConfigDir, "config"), configContent);
    });

    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["config:show", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should not require any arguments", async () => {
      const { error, stdout } = await runCommand(
        ["config:show"],
        import.meta.url,
      );

      // Should not error for missing arguments
      expect(error?.message || "").not.toMatch(/Missing.*required/i);
      expect(stdout).toContain("[current]");
    });
  });
});
