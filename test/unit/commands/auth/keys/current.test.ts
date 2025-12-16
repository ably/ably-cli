import { describe, it, expect } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockConfigManager } from "../../../../helpers/mock-config-manager.js";

describe("auth:keys:current command", () => {
  describe("successful key display", () => {
    it("should display the current API key", async () => {
      const mockConfig = getMockConfigManager();
      const keyId = mockConfig.getKeyId()!;
      const apiKey = mockConfig.getApiKey()!;
      const { stdout } = await runCommand(
        ["auth:keys:current"],
        import.meta.url,
      );

      expect(stdout).toContain(`API Key: ${keyId}`);
      expect(stdout).toContain(`Key Value: ${apiKey}`);
    });

    it("should display account and app information", async () => {
      const mockConfig = getMockConfigManager();
      const accountName = mockConfig.getCurrentAccount()!.accountName!;
      const appId = mockConfig.getCurrentAppId()!;
      const appName = mockConfig.getAppName(appId)!;
      const { stdout } = await runCommand(
        ["auth:keys:current"],
        import.meta.url,
      );

      expect(stdout).toContain(`Account: ${accountName}`);
      expect(stdout).toContain(`App: ${appName} (${appId})`);
    });

    it("should output JSON format when --json flag is used", async () => {
      const { stdout } = await runCommand(
        ["auth:keys:current", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("app");
      expect(result).toHaveProperty("key");
      expect(result.key).toHaveProperty("value");
    });
  });

  describe("error handling", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["auth:keys:current", "--unknown-flag-xyz"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should accept --app flag to specify a different app", async () => {
      const mockConfig = getMockConfigManager();
      const appId = mockConfig.getCurrentAppId()!;
      const keyId = mockConfig.getKeyId()!;
      const { stdout } = await runCommand(
        ["auth:keys:current", "--app", appId],
        import.meta.url,
      );

      expect(stdout).toContain(`API Key: ${keyId}`);
    });
  });
});
