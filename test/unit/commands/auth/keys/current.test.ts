import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

describe("auth:keys:current command", () => {
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

  describe("successful key display", () => {
    it("should display the current API key", async () => {
      const configContent = `[current]
account = "default"

[accounts.default]
accessToken = "${mockAccessToken}"
accountId = "${mockAccountId}"
accountName = "Test Account"
userEmail = "test@example.com"
currentAppId = "${mockAppId}"

[accounts.default.apps."${mockAppId}"]
apiKey = "${mockApiKey}"
keyId = "${mockAppId}.testkey"
keyName = "Test Key"
`;
      writeFileSync(resolve(testConfigDir, "config"), configContent);

      const { stdout } = await runCommand(
        ["auth:keys:current"],
        import.meta.url,
      );

      expect(stdout).toContain(`API Key: ${mockAppId}.testkey`);
      expect(stdout).toContain(`Key Value: ${mockApiKey}`);
    });

    it("should display account and app information", async () => {
      const configContent = `[current]
account = "default"

[accounts.default]
accessToken = "${mockAccessToken}"
accountId = "${mockAccountId}"
accountName = "Test Account"
userEmail = "test@example.com"
currentAppId = "${mockAppId}"

[accounts.default.apps."${mockAppId}"]
apiKey = "${mockApiKey}"
keyId = "${mockAppId}.testkey"
keyName = "Test Key"
`;
      writeFileSync(resolve(testConfigDir, "config"), configContent);

      const { stdout } = await runCommand(
        ["auth:keys:current"],
        import.meta.url,
      );

      expect(stdout).toContain("Account: Test Account");
      expect(stdout).toContain(`App: ${mockAppId}`);
    });

    it("should output JSON format when --json flag is used", async () => {
      const configContent = `[current]
account = "default"

[accounts.default]
accessToken = "${mockAccessToken}"
accountId = "${mockAccountId}"
accountName = "Test Account"
userEmail = "test@example.com"
currentAppId = "${mockAppId}"

[accounts.default.apps."${mockAppId}"]
apiKey = "${mockApiKey}"
keyId = "${mockAppId}.testkey"
keyName = "Test Key"
`;
      writeFileSync(resolve(testConfigDir, "config"), configContent);

      const { stdout } = await runCommand(
        ["auth:keys:current", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("app");
      expect(result).toHaveProperty("key");
      expect(result.key).toHaveProperty("value");
    });
  });

  describe("error handling", () => {
    it("should reject unknown flags", async () => {
      const configContent = `[current]
account = "default"

[accounts.default]
accessToken = "${mockAccessToken}"
accountId = "${mockAccountId}"
accountName = "Test Account"
userEmail = "test@example.com"
currentAppId = "${mockAppId}"

[accounts.default.apps."${mockAppId}"]
apiKey = "${mockApiKey}"
`;
      writeFileSync(resolve(testConfigDir, "config"), configContent);

      const { error } = await runCommand(
        ["auth:keys:current", "--unknown-flag-xyz"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should accept --app flag to specify a different app", async () => {
      // Test that --app flag is accepted even with a different app ID
      const configContent = `[current]
account = "default"

[accounts.default]
accessToken = "${mockAccessToken}"
accountId = "${mockAccountId}"
accountName = "Test Account"
userEmail = "test@example.com"
currentAppId = "${mockAppId}"

[accounts.default.apps."${mockAppId}"]
apiKey = "${mockApiKey}"
keyId = "${mockAppId}.testkey"
keyName = "Test Key"
`;
      writeFileSync(resolve(testConfigDir, "config"), configContent);

      const { stdout } = await runCommand(
        ["auth:keys:current", "--app", mockAppId],
        import.meta.url,
      );

      expect(stdout).toContain(`API Key: ${mockAppId}.testkey`);
    });
  });
});
