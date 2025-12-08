import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

describe("auth:keys:list command", () => {
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
  });

  afterEach(() => {
    nock.cleanAll();
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

  describe("successful key listing", () => {
    it("should list all keys for the current app", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/keys`)
        .reply(200, [
          {
            id: "key1",
            appId: mockAppId,
            name: "Key One",
            key: `${mockAppId}.key1:secret1`,
            capability: { "*": ["publish", "subscribe"] },
            created: Date.now(),
            modified: Date.now(),
          },
          {
            id: "key2",
            appId: mockAppId,
            name: "Key Two",
            key: `${mockAppId}.key2:secret2`,
            capability: { "*": ["subscribe"] },
            created: Date.now(),
            modified: Date.now(),
          },
        ]);

      const { stdout } = await runCommand(["auth:keys:list"], import.meta.url);

      expect(stdout).toContain(`Key Name: ${mockAppId}.key1`);
      expect(stdout).toContain("Key Label: Key One");
      expect(stdout).toContain(`Key Name: ${mockAppId}.key2`);
      expect(stdout).toContain("Key Label: Key Two");
    });

    it("should list keys with --app flag", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/keys`)
        .reply(200, [
          {
            id: "key1",
            appId: mockAppId,
            name: "Test Key",
            key: `${mockAppId}.key1:secret`,
            capability: { "*": ["publish"] },
            created: Date.now(),
            modified: Date.now(),
          },
        ]);

      const { stdout } = await runCommand(
        ["auth:keys:list", "--app", mockAppId],
        import.meta.url,
      );

      expect(stdout).toContain(`Key Name: ${mockAppId}.key1`);
      expect(stdout).toContain("Key Label: Test Key");
    });

    it("should show message when no keys found", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/keys`)
        .reply(200, []);

      const { stdout } = await runCommand(["auth:keys:list"], import.meta.url);

      expect(stdout).toContain("No keys found");
    });

    it("should output JSON format when --json flag is used", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/keys`)
        .reply(200, [
          {
            id: "key1",
            appId: mockAppId,
            name: "Test Key",
            key: `${mockAppId}.key1:secret`,
            capability: { "*": ["publish", "subscribe"] },
            created: Date.now(),
            modified: Date.now(),
          },
        ]);

      const { stdout } = await runCommand(
        ["auth:keys:list", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("keys");
      expect(result.keys).toHaveLength(1);
      expect(result.keys[0]).toHaveProperty("name", "Test Key");
    });
  });

  describe("error handling", () => {
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

      const { error } = await runCommand(["auth:keys:list"], import.meta.url);

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/No app specified/);
    });

    it("should handle 401 authentication error", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/keys`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(["auth:keys:list"], import.meta.url);

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/401/);
    });

    it("should handle network errors", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/keys`)
        .replyWithError("Network error");

      const { error } = await runCommand(["auth:keys:list"], import.meta.url);

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Network error/);
    });
  });
});
