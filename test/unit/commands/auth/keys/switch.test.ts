import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import {
  nockControl,
  controlApiCleanup,
  getControlApiContext,
} from "../../../../helpers/control-api-test-helpers.js";
import { getMockConfigManager } from "../../../../helpers/mock-config-manager.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("auth:keys:switch command", () => {
  const mockKeyId = "key-abc123";
  const mockKeyName = "Test Key";

  beforeEach(() => {
    controlApiCleanup();
  });

  afterEach(() => {
    controlApiCleanup();
  });

  standardHelpTests("auth:keys:switch", import.meta.url);

  standardArgValidationTests("auth:keys:switch", import.meta.url);

  describe("functionality", () => {
    it("should switch to a key when key ID is provided with app.keyId format", async () => {
      const mockConfig = getMockConfigManager();
      const appId = mockConfig.getCurrentAppId()!;

      nockControl()
        .get(`/v1/apps/${appId}/keys`)
        .reply(200, [
          {
            id: mockKeyId,
            appId,
            name: mockKeyName,
            key: `${appId}.${mockKeyId}:secret`,
            capability: { "*": ["*"] },
            created: 1640995200000,
            modified: 1640995200000,
          },
        ]);

      const { stdout } = await runCommand(
        ["auth:keys:switch", `${appId}.${mockKeyId}`],
        import.meta.url,
      );

      expect(stdout).toContain("Switched to key");
      expect(stdout).toContain(`${appId}.${mockKeyId}`);
    });

    it("should output JSON when --json flag is used", async () => {
      const mockConfig = getMockConfigManager();
      const appId = mockConfig.getCurrentAppId()!;

      nockControl()
        .get(`/v1/apps/${appId}/keys`)
        .reply(200, [
          {
            id: mockKeyId,
            appId,
            name: mockKeyName,
            key: `${appId}.${mockKeyId}:secret`,
            capability: { "*": ["*"] },
            created: 1640995200000,
            modified: 1640995200000,
          },
        ]);

      const { stdout } = await runCommand(
        ["auth:keys:switch", `${appId}.${mockKeyId}`, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "auth:keys:switch");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("key");
      expect(result.key).toHaveProperty("appId", appId);
      expect(result.key).toHaveProperty("keyLabel", mockKeyName);
    });
  });

  standardFlagTests("auth:keys:switch", import.meta.url, ["--app", "--json"]);

  describe("error handling", () => {
    it("should handle key not found error", async () => {
      const mockConfig = getMockConfigManager();
      const appId = mockConfig.getCurrentAppId()!;

      nockControl().get(`/v1/apps/${appId}/keys`).reply(200, []);

      const { error } = await runCommand(
        ["auth:keys:switch", `${appId}.nonexistent-key`],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/not found|access denied/i);
    });

    it("should handle no app specified when config has no current app", async () => {
      const mockConfig = getMockConfigManager();
      const { accountId } = getControlApiContext();
      mockConfig.setCurrentAppIdForAccount(undefined);

      // Mock the app resolution flow (requireAppId → promptForApp → listApps)
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });
      nockControl().get(`/v1/accounts/${accountId}/apps`).reply(200, []);

      const { error } = await runCommand(
        ["auth:keys:switch", "just-a-key-id"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No apps found/i);
    });

    it("should handle 401 authentication error", async () => {
      const mockConfig = getMockConfigManager();
      const appId = mockConfig.getCurrentAppId()!;

      nockControl()
        .get(`/v1/apps/${appId}/keys`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["auth:keys:switch", `${appId}.some-key`],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
