import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { getMockConfigManager } from "../../../../helpers/mock-config-manager.js";
import {
  mockKeysList,
  buildMockKey,
} from "../../../../helpers/mock-control-api-keys.js";

describe("auth:keys:get command", () => {
  const mockKeyId = "testkey";

  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
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

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["auth:keys:get", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("USAGE");
    });
  });

  describe("argument validation", () => {
    it("should require keyNameOrValue argument", async () => {
      const { error } = await runCommand(["auth:keys:get"], import.meta.url);

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing 1 required arg/);
    });
  });

  describe("flags", () => {
    it("should accept --json flag", async () => {
      const { stdout } = await runCommand(
        ["auth:keys:get", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("--json");
    });
  });

  describe("error handling", () => {
    it("should require keyNameOrValue argument", async () => {
      const { error } = await runCommand(["auth:keys:get"], import.meta.url);

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing 1 required arg/);
    });

    it("should handle key not found", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      mockKeysList(appId, [buildMockKey(appId, mockKeyId)]);

      const { error } = await runCommand(
        ["auth:keys:get", `${appId}.nonexistent`],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/not found/);
    });

    it("should handle 401 authentication error", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/keys`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["auth:keys:get", `${appId}.${mockKeyId}`],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/401/);
    });
  });
});
