import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";
import { parseJsonOutput } from "../../../helpers/ndjson.js";

describe("accounts:list command", () => {
  beforeEach(() => {
    // Config is auto-reset by setup.ts
  });

  describe("functionality", () => {
    it("should show message when no accounts configured", async () => {
      const mock = getMockConfigManager();
      mock.clearAccounts();

      const { error } = await runCommand(["accounts:list"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toContain("No accounts configured");
      expect(error?.message).toContain("ably accounts login");
    });

    it("should output JSON error when no accounts with --json", async () => {
      const mock = getMockConfigManager();
      mock.clearAccounts();

      const { stdout } = await runCommand(
        ["accounts:list", "--json"],
        import.meta.url,
      );

      const result = parseJsonOutput(stdout);
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("accounts");
      expect(result.accounts).toEqual([]);
    });
  });

  describe("with accounts", () => {
    it("should display accounts with current marker", async () => {
      const { stdout } = await runCommand(["accounts:list"], import.meta.url);

      expect(stdout).toContain("Found");
      expect(stdout).toContain("accounts:");
      expect(stdout).toContain("(current)");
    });

    it("should show app count per account", async () => {
      const { stdout } = await runCommand(["accounts:list"], import.meta.url);

      expect(stdout).toContain("Apps configured:");
    });

    it("should output JSON with isCurrent flag", async () => {
      const { stdout } = await runCommand(
        ["accounts:list", "--json"],
        import.meta.url,
      );

      const result = parseJsonOutput(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("accounts");
      expect(result.accounts.length).toBeGreaterThan(0);

      const currentAccount = result.accounts.find(
        (a: { isCurrent: boolean }) => a.isCurrent,
      );
      expect(currentAccount).toBeDefined();
      expect(currentAccount.isCurrent).toBe(true);
      expect(currentAccount).toHaveProperty("alias");
      expect(currentAccount).toHaveProperty("appsConfigured");
    });
  });

  standardHelpTests("accounts:list", import.meta.url);
  standardArgValidationTests("accounts:list", import.meta.url);
  standardFlagTests("accounts:list", import.meta.url, ["--json"]);

  describe("error handling", () => {
    it("should handle errors gracefully", async () => {
      const mock = getMockConfigManager();
      mock.clearAccounts();

      const { error } = await runCommand(["accounts:list"], import.meta.url);
      expect(error).toBeDefined();
    });
  });
});
