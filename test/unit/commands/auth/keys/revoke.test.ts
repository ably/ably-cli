import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import {
  nockControl,
  controlApiCleanup,
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

describe("auth:keys:revoke command", () => {
  const mockKeyId = "testkey";

  beforeEach(() => {
    controlApiCleanup();
  });

  afterEach(() => {
    controlApiCleanup();
  });

  describe("functionality", () => {
    it("should display key info before revocation", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      // Mock list keys (getKey now uses list+filter)
      mockKeysList(appId, [buildMockKey(appId, mockKeyId)]);

      // Mock revoke key
      nockControl()
        .delete(`/v1/apps/${appId}/keys/${mockKeyId}`)
        .reply(200, {});

      const { stdout } = await runCommand(
        ["auth:keys:revoke", `${appId}.${mockKeyId}`, "--force"],
        import.meta.url,
      );

      expect(stdout).toContain(`Key Name: ${appId}.${mockKeyId}`);
      expect(stdout).toContain("Key Label: Test Key");
    });

    it("should revoke key with --app flag", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      mockKeysList(appId, [
        buildMockKey(appId, mockKeyId, {
          capability: { "*": ["publish"] },
        }),
      ]);

      nockControl()
        .delete(`/v1/apps/${appId}/keys/${mockKeyId}`)
        .reply(200, {});

      const { stdout } = await runCommand(
        ["auth:keys:revoke", mockKeyId, "--app", appId, "--force"],
        import.meta.url,
      );

      expect(stdout).toContain(`Key Name: ${appId}.${mockKeyId}`);
      expect(stdout).toContain("Key Label: Test Key");
    });

    it("should output JSON format when --json flag is used", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      mockKeysList(appId, [buildMockKey(appId, mockKeyId)]);

      nockControl()
        .delete(`/v1/apps/${appId}/keys/${mockKeyId}`)
        .reply(200, {});

      const { stdout } = await runCommand(
        ["auth:keys:revoke", `${appId}.${mockKeyId}`, "--force", "--json"],
        import.meta.url,
      );

      // The JSON output should be parseable
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "auth:keys:revoke");
      expect(result).toHaveProperty("success", true);
    });
  });

  standardHelpTests("auth:keys:revoke", import.meta.url);

  standardArgValidationTests("auth:keys:revoke", import.meta.url, {
    requiredArgs: ["test-key"],
  });

  standardFlagTests("auth:keys:revoke", import.meta.url, ["--json"]);

  describe("error handling", () => {
    it("should require keyName argument", async () => {
      const { error } = await runCommand(
        ["auth:keys:revoke", "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Missing 1 required arg/);
    });

    it("should handle key not found", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      // Return list with no matching key
      mockKeysList(appId, [buildMockKey(appId, mockKeyId)]);

      const { error } = await runCommand(
        ["auth:keys:revoke", `${appId}.nonexistent`, "--force"],
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
        ["auth:keys:revoke", `${appId}.${mockKeyId}`, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/401/);
    });
  });
});
