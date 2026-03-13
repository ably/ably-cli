import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import {
  nockControl,
  controlApiCleanup,
  mockAppResolution,
} from "../../../../helpers/control-api-test-helpers.js";
import { getMockConfigManager } from "../../../../helpers/mock-config-manager.js";
import {
  mockKeysList,
  buildMockKey,
} from "../../../../helpers/mock-control-api-keys.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("auth:keys:update command", () => {
  const mockKeyId = "testkey";

  beforeEach(() => {
    controlApiCleanup();
  });

  afterEach(() => {
    controlApiCleanup();
  });

  describe("functionality", () => {
    it("should update key name", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      // Mock list keys (getKey now uses list+filter)
      mockKeysList(appId, [
        buildMockKey(appId, mockKeyId, { name: "OldName" }),
      ]);

      // Mock update key
      nockControl()
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
      mockKeysList(appId, [buildMockKey(appId, mockKeyId)]);

      nockControl()
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
      mockAppResolution(appId);
      mockKeysList(appId, [
        buildMockKey(appId, mockKeyId, {
          name: "OldName",
          capability: { "*": ["publish"] },
        }),
      ]);

      nockControl()
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

  standardHelpTests("auth:keys:update", import.meta.url);

  standardArgValidationTests("auth:keys:update", import.meta.url, {
    requiredArgs: ["test-key"],
  });

  standardFlagTests("auth:keys:update", import.meta.url, ["--json"]);

  describe("error handling", () => {
    it("should require keyName argument", async () => {
      const { error } = await runCommand(
        ["auth:keys:update", "--name", "Test"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Missing 1 required arg/);
    });

    it("should require at least one update parameter", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const { error } = await runCommand(
        ["auth:keys:update", `${appId}.${mockKeyId}`],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No updates specified/);
    });

    it("should handle key not found", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      // Return list with no matching key
      mockKeysList(appId, [buildMockKey(appId, mockKeyId)]);

      const { error } = await runCommand(
        ["auth:keys:update", `${appId}.nonexistent`, "--name=NewName"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/not found/);
    });

    it("should handle 401 authentication error", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/keys`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["auth:keys:update", `${appId}.${mockKeyId}`, "--name=NewName"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/401/);
    });
  });
});
