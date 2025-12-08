import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

describe("auth:keys:update command", () => {
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

  describe("successful key update", () => {
    it("should update key name", async () => {
      // Mock get key details
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId: mockAppId,
          name: "OldName",
          key: `${mockAppId}.${mockKeyId}:secret`,
          capability: { "*": ["publish", "subscribe"] },
          created: Date.now(),
          modified: Date.now(),
        });

      // Mock update key
      nock("https://control.ably.net")
        .patch(`/v1/apps/${mockAppId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId: mockAppId,
          name: "NewName",
          key: `${mockAppId}.${mockKeyId}:secret`,
          capability: { "*": ["publish", "subscribe"] },
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout } = await runCommand(
        ["auth:keys:update", `${mockAppId}.${mockKeyId}`, "--name=NewName"],
        import.meta.url,
      );

      expect(stdout).toContain(`Key Name: ${mockAppId}.${mockKeyId}`);
      expect(stdout).toContain(`Key Label: "OldName" → "NewName"`);
    });

    it("should update key capabilities", async () => {
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

      nock("https://control.ably.net")
        .patch(`/v1/apps/${mockAppId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId: mockAppId,
          name: "Test Key",
          key: `${mockAppId}.${mockKeyId}:secret`,
          capability: { "*": ["subscribe"] },
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout } = await runCommand(
        [
          "auth:keys:update",
          `${mockAppId}.${mockKeyId}`,
          "--capabilities",
          "subscribe",
        ],
        import.meta.url,
      );

      expect(stdout).toContain(`Key Name: ${mockAppId}.${mockKeyId}`);
      expect(stdout).toContain("After:  * → subscribe");
    });

    it("should update key with --app flag", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId: mockAppId,
          name: "OldName",
          key: `${mockAppId}.${mockKeyId}:secret`,
          capability: { "*": ["publish"] },
          created: Date.now(),
          modified: Date.now(),
        });

      nock("https://control.ably.net")
        .patch(`/v1/apps/${mockAppId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId: mockAppId,
          name: "UpdatedName",
          key: `${mockAppId}.${mockKeyId}:secret`,
          capability: { "*": ["publish"] },
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout } = await runCommand(
        [
          "auth:keys:update",
          mockKeyId,
          "--app",
          mockAppId,
          "--name=UpdatedName",
        ],
        import.meta.url,
      );

      expect(stdout).toContain(`Key Name: ${mockAppId}.${mockKeyId}`);
      expect(stdout).toContain(`Key Label: "OldName" → "UpdatedName"`);
    });
  });

  describe("error handling", () => {
    it("should require keyName argument", async () => {
      const { error } = await runCommand(
        ["auth:keys:update", "--name", "Test"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing 1 required arg/);
    });

    it("should require at least one update parameter", async () => {
      const { error } = await runCommand(
        ["auth:keys:update", `${mockAppId}.${mockKeyId}`],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/No updates specified/);
    });

    it("should handle 404 key not found", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/keys/nonexistent`)
        .reply(404, { error: "Key not found" });

      const { error } = await runCommand(
        ["auth:keys:update", `${mockAppId}.nonexistent`, "--name=NewName"],
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
        ["auth:keys:update", `${mockAppId}.${mockKeyId}`, "--name=NewName"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/401/);
    });
  });
});
