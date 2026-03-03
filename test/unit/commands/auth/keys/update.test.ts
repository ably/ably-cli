import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { getMockConfigManager } from "../../../../helpers/mock-config-manager.js";

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
      const appId = getMockConfigManager().getCurrentAppId()!;
      // Mock get key details
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId,
          name: "OldName",
          key: `${appId}.${mockKeyId}:secret`,
          capability: { "*": ["publish", "subscribe"] },
          created: Date.now(),
          modified: Date.now(),
        });

      // Mock update key
      nock("https://control.ably.net")
        .patch(`/v1/apps/${appId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId,
          name: "NewName",
          key: `${appId}.${mockKeyId}:secret`,
          capability: { "*": ["publish", "subscribe"] },
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout } = await runCommand(
        ["auth:keys:update", `${appId}.${mockKeyId}`, "--name=NewName"],
        import.meta.url,
      );

      expect(stdout).toContain(`Key Name: ${appId}.${mockKeyId}`);
      expect(stdout).toContain(`Key Label: "OldName" → "NewName"`);
    });

    it("should update key capabilities", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId,
          name: "Test Key",
          key: `${appId}.${mockKeyId}:secret`,
          capability: { "*": ["publish", "subscribe"] },
          created: Date.now(),
          modified: Date.now(),
        });

      nock("https://control.ably.net")
        .patch(`/v1/apps/${appId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId,
          name: "Test Key",
          key: `${appId}.${mockKeyId}:secret`,
          capability: { "*": ["subscribe"] },
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout } = await runCommand(
        [
          "auth:keys:update",
          `${appId}.${mockKeyId}`,
          "--capabilities",
          "subscribe",
        ],
        import.meta.url,
      );

      expect(stdout).toContain(`Key Name: ${appId}.${mockKeyId}`);
      expect(stdout).toContain("After:  * → subscribe");
    });

    it("should update key with --app flag", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId,
          name: "OldName",
          key: `${appId}.${mockKeyId}:secret`,
          capability: { "*": ["publish"] },
          created: Date.now(),
          modified: Date.now(),
        });

      nock("https://control.ably.net")
        .patch(`/v1/apps/${appId}/keys/${mockKeyId}`)
        .reply(200, {
          id: mockKeyId,
          appId,
          name: "UpdatedName",
          key: `${appId}.${mockKeyId}:secret`,
          capability: { "*": ["publish"] },
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout } = await runCommand(
        ["auth:keys:update", mockKeyId, "--app", appId, "--name=UpdatedName"],
        import.meta.url,
      );

      expect(stdout).toContain(`Key Name: ${appId}.${mockKeyId}`);
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
      const appId = getMockConfigManager().getCurrentAppId()!;
      const { error } = await runCommand(
        ["auth:keys:update", `${appId}.${mockKeyId}`],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/No updates specified/);
    });

    it("should handle 404 key not found", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/keys/nonexistent`)
        .reply(404, { error: "Key not found" });

      const { error } = await runCommand(
        ["auth:keys:update", `${appId}.nonexistent`, "--name=NewName"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/404/);
    });

    it("should handle 401 authentication error", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/keys/${mockKeyId}`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["auth:keys:update", `${appId}.${mockKeyId}`, "--name=NewName"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/401/);
    });
  });
});
