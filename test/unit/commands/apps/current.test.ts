import { describe, it, expect } from "vitest";
import { runCommand } from "@oclif/test";
import {
  getMockConfigManager,
  DEFAULT_TEST_CONFIG,
} from "../../../helpers/mock-config-manager.js";

describe("apps:current command", () => {
  describe("successful current app display", () => {
    it("should display the current app", async () => {
      const { stdout } = await runCommand(["apps:current"], import.meta.url);

      expect(stdout).toContain(`App: ${DEFAULT_TEST_CONFIG.appName}`);
      expect(stdout).toContain(`(${DEFAULT_TEST_CONFIG.appId})`);
    });

    it("should display account information", async () => {
      const { stdout } = await runCommand(["apps:current"], import.meta.url);

      expect(stdout).toContain(`Account: ${DEFAULT_TEST_CONFIG.accountName}`);
    });

    it("should display API key info when set", async () => {
      const { stdout } = await runCommand(["apps:current"], import.meta.url);

      expect(stdout).toContain(`API Key: ${DEFAULT_TEST_CONFIG.keyId}`);
      expect(stdout).toContain(`Key Label: ${DEFAULT_TEST_CONFIG.keyName}`);
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
