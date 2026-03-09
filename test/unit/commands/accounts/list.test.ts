import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";

describe("accounts:list command", () => {
  beforeEach(() => {
    // Config is auto-reset by setup.ts
  });

  describe("no accounts", () => {
    it("should show message when no accounts configured", async () => {
      const mock = getMockConfigManager();
      mock.clearAccounts();

      const { stdout } = await runCommand(["accounts:list"], import.meta.url);

      expect(stdout).toContain("No accounts configured");
      expect(stdout).toContain("ably accounts login");
    });

    it("should output JSON error when no accounts with --json", async () => {
      const mock = getMockConfigManager();
      mock.clearAccounts();

      const { stdout } = await runCommand(
        ["accounts:list", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
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

      const result = JSON.parse(stdout);
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
});
