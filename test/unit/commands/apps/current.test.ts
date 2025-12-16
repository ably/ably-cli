import { describe, it, expect } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";

describe("apps:current command", () => {
  describe("successful current app display", () => {
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
