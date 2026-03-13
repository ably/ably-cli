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
  standardControlApiErrorTests,
} from "../../../../helpers/standard-tests.js";

describe("auth:keys:get command", () => {
  const mockKeyId = "testkey";

  beforeEach(() => {
    controlApiCleanup();
  });

  afterEach(() => {
    controlApiCleanup();
  });

  describe("functionality", () => {
    it("should get key details by full key name (APP_ID.KEY_ID)", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      mockKeysList(appId, [buildMockKey(appId, mockKeyId)]);

      const { stdout } = await runCommand(
        ["auth:keys:get", `${appId}.${mockKeyId}`],
        import.meta.url,
      );

      expect(stdout).toContain(`Key Name: ${appId}.${mockKeyId}`);
      expect(stdout).toContain("Key Label: Test Key");
    });

    it("should get key details with --app flag", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      mockAppResolution(appId);
      mockKeysList(appId, [buildMockKey(appId, mockKeyId)]);

      const { stdout } = await runCommand(
        ["auth:keys:get", mockKeyId, "--app", appId],
        import.meta.url,
      );

      expect(stdout).toContain(`Key Name: ${appId}.${mockKeyId}`);
      expect(stdout).toContain("Key Label: Test Key");
    });

    it("should get key details by label name", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      mockAppResolution(appId);
      mockKeysList(appId, [
        buildMockKey(appId, mockKeyId, { name: "Root" }),
        buildMockKey(appId, "otherkey", { name: "Secondary" }),
      ]);

      const { stdout } = await runCommand(
        ["auth:keys:get", "Root", "--app", appId],
        import.meta.url,
      );

      expect(stdout).toContain(`Key Name: ${appId}.${mockKeyId}`);
      expect(stdout).toContain("Key Label: Root");
    });

    it("should get key details by label containing a period (e.g. v1.0)", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      mockAppResolution(appId);
      mockKeysList(appId, [
        buildMockKey(appId, mockKeyId, { name: "v1.0" }),
        buildMockKey(appId, "otherkey", { name: "Secondary" }),
      ]);

      const { stdout } = await runCommand(
        ["auth:keys:get", "v1.0", "--app", appId],
        import.meta.url,
      );

      expect(stdout).toContain(`Key Name: ${appId}.${mockKeyId}`);
      expect(stdout).toContain("Key Label: v1.0");
    });

    it("should get key details by key ID only", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      mockAppResolution(appId);
      mockKeysList(appId, [
        buildMockKey(appId, mockKeyId),
        buildMockKey(appId, "otherkey", { name: "Secondary" }),
      ]);

      const { stdout } = await runCommand(
        ["auth:keys:get", mockKeyId, "--app", appId],
        import.meta.url,
      );

      expect(stdout).toContain(`Key Name: ${appId}.${mockKeyId}`);
      expect(stdout).toContain("Key Label: Test Key");
    });

    it("should output JSON format when --json flag is used", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      mockKeysList(appId, [buildMockKey(appId, mockKeyId)]);

      const { stdout } = await runCommand(
        ["auth:keys:get", `${appId}.${mockKeyId}`, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("key");
      expect(result.key).toHaveProperty("id", mockKeyId);
    });
  });

  standardHelpTests("auth:keys:get", import.meta.url);

  standardArgValidationTests("auth:keys:get", import.meta.url, {
    requiredArgs: ["test-key"],
  });

  standardFlagTests("auth:keys:get", import.meta.url, ["--json"]);

  describe("error handling", () => {
    it("should require keyNameOrValue argument", async () => {
      const { error } = await runCommand(["auth:keys:get"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Missing 1 required arg/);
    });

    it("should handle key not found", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      mockKeysList(appId, [buildMockKey(appId, mockKeyId)]);

      const { error } = await runCommand(
        ["auth:keys:get", `${appId}.nonexistent`],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/not found/);
    });

    standardControlApiErrorTests({
      commandArgs: ["auth:keys:get", mockKeyId],
      importMetaUrl: import.meta.url,
      setupNock: (scenario) => {
        const appId = getMockConfigManager().getCurrentAppId()!;
        const scope = nockControl().get(`/v1/apps/${appId}/keys`);
        if (scenario === "401") scope.reply(401, { error: "Unauthorized" });
        else if (scenario === "500")
          scope.reply(500, { error: "Internal Server Error" });
        else scope.replyWithError("Network error");
      },
    });
  });
});
