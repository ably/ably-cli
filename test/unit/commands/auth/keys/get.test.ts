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
  let savedAblyApiKey: string | undefined;

  beforeEach(() => {
    controlApiCleanup();
    savedAblyApiKey = process.env.ABLY_API_KEY;
    delete process.env.ABLY_API_KEY;
  });

  afterEach(() => {
    controlApiCleanup();
    if (savedAblyApiKey === undefined) {
      delete process.env.ABLY_API_KEY;
    } else {
      process.env.ABLY_API_KEY = savedAblyApiKey;
    }
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

    it("should show warning when fetched key is current and ABLY_API_KEY env var overrides it", async () => {
      const mockConfig = getMockConfigManager();
      const appId = mockConfig.getCurrentAppId()!;
      const currentKeyId = mockConfig.getKeyId(appId)!;
      // Build a mock key whose appId.id matches the current key
      const keyIdPart = currentKeyId.includes(".")
        ? currentKeyId.split(".")[1]
        : currentKeyId;
      mockKeysList(appId, [buildMockKey(appId, keyIdPart)]);

      // Set env var to a different key
      process.env.ABLY_API_KEY = `${appId}.differentkey:secret`;

      const { stderr } = await runCommand(
        ["auth:keys:get", `${appId}.${keyIdPart}`],
        import.meta.url,
      );

      expect(stderr).toContain(
        "ABLY_API_KEY environment variable is set to a different key",
      );
      expect(stderr).toContain(`${appId}.differentkey`);
    });

    it("should not show warning when fetched key is not the current key", async () => {
      const mockConfig = getMockConfigManager();
      const appId = mockConfig.getCurrentAppId()!;
      mockKeysList(appId, [
        buildMockKey(appId, mockKeyId),
        buildMockKey(appId, "otherkey", { name: "Other" }),
      ]);

      // Set env var to a different key — but we're fetching a non-current key
      process.env.ABLY_API_KEY = `${appId}.differentkey:secret`;

      const { stderr } = await runCommand(
        ["auth:keys:get", mockKeyId, "--app", appId],
        import.meta.url,
      );

      expect(stderr).not.toContain("ABLY_API_KEY environment variable");
    });

    it("should not show warning when ABLY_API_KEY matches the fetched key", async () => {
      const mockConfig = getMockConfigManager();
      const appId = mockConfig.getCurrentAppId()!;
      const currentKeyId = mockConfig.getKeyId(appId)!;
      const keyIdPart = currentKeyId.includes(".")
        ? currentKeyId.split(".")[1]
        : currentKeyId;
      mockKeysList(appId, [buildMockKey(appId, keyIdPart)]);

      // Set env var to same key
      process.env.ABLY_API_KEY = `${appId}.${keyIdPart}:secret`;

      const { stdout } = await runCommand(
        ["auth:keys:get", `${appId}.${keyIdPart}`],
        import.meta.url,
      );

      expect(stdout).not.toContain("ABLY_API_KEY environment variable");
    });

    it("should include envKeyOverride in JSON when condition is met", async () => {
      const mockConfig = getMockConfigManager();
      const appId = mockConfig.getCurrentAppId()!;
      const currentKeyId = mockConfig.getKeyId(appId)!;
      const keyIdPart = currentKeyId.includes(".")
        ? currentKeyId.split(".")[1]
        : currentKeyId;
      mockKeysList(appId, [buildMockKey(appId, keyIdPart)]);

      process.env.ABLY_API_KEY = `${appId}.differentkey:secret`;

      const { stdout } = await runCommand(
        ["auth:keys:get", `${appId}.${keyIdPart}`, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("envKeyOverride");
      expect(result.envKeyOverride).toHaveProperty(
        "keyName",
        `${appId}.differentkey`,
      );
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
