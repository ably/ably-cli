import { describe, it, expect } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";

describe("apps:current command", () => {
  describe("functionality", () => {
    it("should display the current app", async () => {
      const mockConfig = getMockConfigManager();
      const appId = mockConfig.getCurrentAppId()!;
      const appName = mockConfig.getAppName(appId)!;
      const { stdout } = await runCommand(["apps:current"], import.meta.url);

      expect(stdout).toContain(`App: ${appName}`);
      expect(stdout).toContain(`(${appId})`);
    });

    it("should display account information", async () => {
      const accountName =
        getMockConfigManager().getCurrentAccount()!.accountName!;
      const { stdout } = await runCommand(["apps:current"], import.meta.url);

      expect(stdout).toContain(`Account: ${accountName}`);
    });

    it("should display API key info when set", async () => {
      const mockConfig = getMockConfigManager();
      const keyId = mockConfig.getKeyId()!;
      const keyName = mockConfig.getKeyName()!;
      const { stdout } = await runCommand(["apps:current"], import.meta.url);

      expect(stdout).toContain(`API Key: ${keyId}`);
      expect(stdout).toContain(`Key Label: ${keyName}`);
    });
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["apps:current", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("USAGE");
    });
  });

  describe("argument validation", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["apps:current", "--unknown-flag-xyz"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("flags", () => {
    it("should accept --json flag", async () => {
      const { stdout } = await runCommand(
        ["apps:current", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("--json");
    });
  });

  describe("error handling", () => {
    it("should error when no account is selected", async () => {
      const mock = getMockConfigManager();
      mock.setCurrentAccountAlias(undefined);

      const { error } = await runCommand(["apps:current"], import.meta.url);

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/No account selected/);
    });

    it("should error when no app is selected", async () => {
      const mock = getMockConfigManager();
      mock.setCurrentAppIdForAccount(undefined);

      const { error } = await runCommand(["apps:current"], import.meta.url);

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/No app selected/);
    });
  });
});
