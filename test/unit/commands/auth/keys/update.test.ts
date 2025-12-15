import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { DEFAULT_TEST_CONFIG } from "../../../../helpers/mock-config-manager.js";

describe("auth:keys:update command", () => {
  const mockKeyId = "testkey";

  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe("successful key update", () => {
    it("should update key name", async () => {
      // Mock get key details
      nock("https://control.ably.net")
        .get(`/v1/apps/${DEFAULT_TEST_CONFIG.appId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId: DEFAULT_TEST_CONFIG.appId,
          name: "OldName",
          key: `${DEFAULT_TEST_CONFIG.appId}.${mockKeyId}:secret`,
          capability: { "*": ["publish", "subscribe"] },
          created: Date.now(),
          modified: Date.now(),
        });

      // Mock update key
      nock("https://control.ably.net")
        .patch(`/v1/apps/${DEFAULT_TEST_CONFIG.appId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId: DEFAULT_TEST_CONFIG.appId,
          name: "NewName",
          key: `${DEFAULT_TEST_CONFIG.appId}.${mockKeyId}:secret`,
          capability: { "*": ["publish", "subscribe"] },
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout } = await runCommand(
        [
          "auth:keys:update",
          `${DEFAULT_TEST_CONFIG.appId}.${mockKeyId}`,
          "--name=NewName",
        ],
        import.meta.url,
      );

      expect(stdout).toContain(
        `Key Name: ${DEFAULT_TEST_CONFIG.appId}.${mockKeyId}`,
      );
      expect(stdout).toContain(`Key Label: "OldName" → "NewName"`);
    });

    it("should update key capabilities", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${DEFAULT_TEST_CONFIG.appId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId: DEFAULT_TEST_CONFIG.appId,
          name: "Test Key",
          key: `${DEFAULT_TEST_CONFIG.appId}.${mockKeyId}:secret`,
          capability: { "*": ["publish", "subscribe"] },
          created: Date.now(),
          modified: Date.now(),
        });

      nock("https://control.ably.net")
        .patch(`/v1/apps/${DEFAULT_TEST_CONFIG.appId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId: DEFAULT_TEST_CONFIG.appId,
          name: "Test Key",
          key: `${DEFAULT_TEST_CONFIG.appId}.${mockKeyId}:secret`,
          capability: { "*": ["subscribe"] },
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout } = await runCommand(
        [
          "auth:keys:update",
          `${DEFAULT_TEST_CONFIG.appId}.${mockKeyId}`,
          "--capabilities",
          "subscribe",
        ],
        import.meta.url,
      );

      expect(stdout).toContain(
        `Key Name: ${DEFAULT_TEST_CONFIG.appId}.${mockKeyId}`,
      );
      expect(stdout).toContain("After:  * → subscribe");
    });

    it("should update key with --app flag", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${DEFAULT_TEST_CONFIG.appId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId: DEFAULT_TEST_CONFIG.appId,
          name: "OldName",
          key: `${DEFAULT_TEST_CONFIG.appId}.${mockKeyId}:secret`,
          capability: { "*": ["publish"] },
          created: Date.now(),
          modified: Date.now(),
        });

      nock("https://control.ably.net")
        .patch(`/v1/apps/${DEFAULT_TEST_CONFIG.appId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId: DEFAULT_TEST_CONFIG.appId,
          name: "UpdatedName",
          key: `${DEFAULT_TEST_CONFIG.appId}.${mockKeyId}:secret`,
          capability: { "*": ["publish"] },
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout } = await runCommand(
        [
          "auth:keys:update",
          mockKeyId,
          "--app",
          DEFAULT_TEST_CONFIG.appId,
          "--name=UpdatedName",
        ],
        import.meta.url,
      );

      expect(stdout).toContain(
        `Key Name: ${DEFAULT_TEST_CONFIG.appId}.${mockKeyId}`,
      );
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
        ["auth:keys:update", `${DEFAULT_TEST_CONFIG.appId}.${mockKeyId}`],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/No updates specified/);
    });

    it("should handle 404 key not found", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${DEFAULT_TEST_CONFIG.appId}/keys/nonexistent`)
        .reply(404, { error: "Key not found" });

      const { error } = await runCommand(
        [
          "auth:keys:update",
          `${DEFAULT_TEST_CONFIG.appId}.nonexistent`,
          "--name=NewName",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/404/);
    });

    it("should handle 401 authentication error", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${DEFAULT_TEST_CONFIG.appId}/keys/${mockKeyId}`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        [
          "auth:keys:update",
          `${DEFAULT_TEST_CONFIG.appId}.${mockKeyId}`,
          "--name=NewName",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/401/);
    });
  });
});
