import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

describe("apps:current command", () => {
  const mockAccessToken = "fake_access_token";
  const mockAccountId = "test-account-id";
  const mockAppId = "550e8400-e29b-41d4-a716-446655440000";
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

  describe("successful current app display", () => {
    it("should display the current app", async () => {
      const configContent = `[current]
account = "default"

[accounts.default]
accessToken = "${mockAccessToken}"
accountId = "${mockAccountId}"
accountName = "Test Account"
userEmail = "test@example.com"
currentAppId = "${mockAppId}"
`;
      writeFileSync(resolve(testConfigDir, "config"), configContent);

      const { stdout } = await runCommand(["apps:current"], import.meta.url);

      expect(stdout).toContain(`App: ${mockAppId}`);
    });

    it("should display account information", async () => {
      const configContent = `[current]
account = "default"

[accounts.default]
accessToken = "${mockAccessToken}"
accountId = "${mockAccountId}"
accountName = "Test Account"
userEmail = "test@example.com"
currentAppId = "${mockAppId}"
`;
      writeFileSync(resolve(testConfigDir, "config"), configContent);

      const { stdout } = await runCommand(["apps:current"], import.meta.url);

      expect(stdout).toContain("Account: Test Account");
    });

    it("should display API key info when set", async () => {
      const configContent = `[current]
account = "default"

[accounts.default]
accessToken = "${mockAccessToken}"
accountId = "${mockAccountId}"
accountName = "Test Account"
userEmail = "test@example.com"
currentAppId = "${mockAppId}"

[accounts.default.apps."${mockAppId}"]
apiKey = "testkey:secret"
keyId = "${mockAppId}.testkey"
keyName = "Test Key"
`;
      writeFileSync(resolve(testConfigDir, "config"), configContent);

      const { stdout } = await runCommand(["apps:current"], import.meta.url);

      expect(stdout).toContain(`API Key: ${mockAppId}.testkey`);
      expect(stdout).toContain("Key Label: Test Key");
    });
  });

  describe("error handling", () => {
    it("should error when no account is selected", async () => {
      const configContent = `[current]
`;
      writeFileSync(resolve(testConfigDir, "config"), configContent);

      const { error } = await runCommand(["apps:current"], import.meta.url);

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/No account selected/);
    });

    it("should error when no app is selected", async () => {
      const configContent = `[current]
account = "default"

[accounts.default]
accessToken = "${mockAccessToken}"
accountId = "${mockAccountId}"
accountName = "Test Account"
userEmail = "test@example.com"
`;
      writeFileSync(resolve(testConfigDir, "config"), configContent);

      const { error } = await runCommand(["apps:current"], import.meta.url);

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/No app selected/);
    });
  });
});
