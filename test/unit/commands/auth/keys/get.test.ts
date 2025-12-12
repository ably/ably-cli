import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

describe("auth:keys:get command", () => {
  const mockAccessToken = "fake_access_token";
  const mockAccountId = "test-account-id";
  const mockAppId = "550e8400-e29b-41d4-a716-446655440000";
  const mockKeyId = "testkey";
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

  describe("successful key retrieval", () => {
    it("should get key details by full key name (APP_ID.KEY_ID)", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId: mockAppId,
          name: "Test Key",
          key: `${mockAppId}.${mockKeyId}:secret`,
          capability: { "*": ["publish", "subscribe"] },
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout } = await runCommand(
        ["auth:keys:get", `${mockAppId}.${mockKeyId}`],
        import.meta.url,
      );

      expect(stdout).toContain(`Key Name: ${mockAppId}.${mockKeyId}`);
      expect(stdout).toContain("Key Label: Test Key");
    });

    it("should get key details with --app flag", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId: mockAppId,
          name: "Test Key",
          key: `${mockAppId}.${mockKeyId}:secret`,
          capability: { "*": ["publish", "subscribe"] },
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout } = await runCommand(
        ["auth:keys:get", mockKeyId, "--app", mockAppId],
        import.meta.url,
      );

      expect(stdout).toContain(`Key Name: ${mockAppId}.${mockKeyId}`);
      expect(stdout).toContain("Key Label: Test Key");
    });

    it("should output JSON format when --json flag is used", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId: mockAppId,
          name: "Test Key",
          key: `${mockAppId}.${mockKeyId}:secret`,
          capability: { "*": ["publish", "subscribe"] },
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout } = await runCommand(
        ["auth:keys:get", `${mockAppId}.${mockKeyId}`, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("key");
      expect(result.key).toHaveProperty("id", mockKeyId);
    });
  });

  describe("error handling", () => {
    it("should require keyNameOrValue argument", async () => {
      const { error } = await runCommand(["auth:keys:get"], import.meta.url);

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing 1 required arg/);
    });

    it("should handle 404 key not found", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/keys/nonexistent`)
        .reply(404, { error: "Key not found" });

      const { error } = await runCommand(
        ["auth:keys:get", `${mockAppId}.nonexistent`],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/404/);
    });

    it("should handle 401 authentication error", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/keys/${mockKeyId}`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["auth:keys:get", `${mockAppId}.${mockKeyId}`],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/401/);
    });
  });
});
