import { describe, it, expect } from "vitest";
import { runCommand } from "@oclif/test";
import { DEFAULT_TEST_CONFIG } from "../../../../helpers/mock-config-manager.js";

describe("auth:keys:current command", () => {
  describe("successful key display", () => {
    it("should display the current API key", async () => {
      const { stdout } = await runCommand(
        ["auth:keys:current"],
        import.meta.url,
      );

      expect(stdout).toContain(`API Key: ${DEFAULT_TEST_CONFIG.keyId}`);
      expect(stdout).toContain(`Key Value: ${DEFAULT_TEST_CONFIG.apiKey}`);
    });

    it("should display account and app information", async () => {
      const { stdout } = await runCommand(
        ["auth:keys:current"],
        import.meta.url,
      );

      expect(stdout).toContain(`Account: ${DEFAULT_TEST_CONFIG.accountName}`);
      expect(stdout).toContain(
        `App: ${DEFAULT_TEST_CONFIG.appName} (${DEFAULT_TEST_CONFIG.appId})`,
      );
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
      const { stdout } = await runCommand(
        ["auth:keys:current", "--app", DEFAULT_TEST_CONFIG.appId],
        import.meta.url,
      );

      expect(stdout).toContain(`API Key: ${DEFAULT_TEST_CONFIG.keyId}`);
    });
  });
});
