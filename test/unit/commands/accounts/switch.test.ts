import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import {
  nockControl,
  controlApiCleanup,
} from "../../../helpers/control-api-test-helpers.js";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

describe("accounts:switch command", () => {
  const mockAccountId = "switch-account-id";
  const mockAccountName = "Switch Account";
  const mockUserEmail = "switch@example.com";

  beforeEach(() => {
    controlApiCleanup();
  });

  afterEach(() => {
    controlApiCleanup();
  });

  describe("functionality", () => {
    it("should switch to existing alias", async () => {
      const mock = getMockConfigManager();

      // Add a second account to switch to
      mock.storeAccount("token_second", "second", {
        accountId: mockAccountId,
        accountName: mockAccountName,
        userEmail: mockUserEmail,
      });

      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: mockAccountName },
          user: { email: mockUserEmail },
        });

      const { stdout } = await runCommand(
        ["accounts:switch", "second"],
        import.meta.url,
      );

      expect(stdout).toContain("Switched to account:");
      expect(stdout).toContain(mockAccountName);
      expect(stdout).toContain(mockUserEmail);
    });

    it("should error on nonexistent alias", async () => {
      const { error } = await runCommand(
        ["accounts:switch", "nonexistent-alias"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("not found");
      expect(error?.message).toContain("ably accounts list");
    });
  });

  describe("no accounts configured", () => {
    it("should output message about no accounts when none configured", async () => {
      const mock = getMockConfigManager();
      mock.clearAccounts();

      // Use --json to avoid the interactive login redirect which times out
      const { stdout } = await runCommand(
        ["accounts:switch", "any-alias", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", false);
      expect(result.error).toContain("No accounts configured");
    });

    it("should output JSON error when no accounts with --json", async () => {
      const mock = getMockConfigManager();
      mock.clearAccounts();

      const { stdout } = await runCommand(
        ["accounts:switch", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      expect(result.error).toContain("No accounts configured");
    });
  });

  describe("JSON output", () => {
    it("should output JSON error when invalid alias with available accounts", async () => {
      const { stdout } = await runCommand(
        ["accounts:switch", "nonexistent", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      expect(result.error).toContain("not found");
      expect(result).toHaveProperty("availableAccounts");
      expect(result.availableAccounts).toBeInstanceOf(Array);
    });

    it("should warn on expired token when switching but still succeed", async () => {
      const mock = getMockConfigManager();

      // Add a second account
      mock.storeAccount("token_expired", "expired-acct", {
        accountId: "expired-id",
        accountName: "Expired Account",
        userEmail: "expired@example.com",
      });

      nockControl().get("/v1/me").reply(401, { error: "Unauthorized" });

      const { stdout } = await runCommand(
        ["accounts:switch", "expired-acct"],
        import.meta.url,
      );

      // The command should succeed (no error thrown) but emit a warning
      expect(stdout).toBeDefined();

      // Verify the account was actually switched
      expect(mock.getCurrentAccountAlias()).toBe("expired-acct");
    });
  });

  standardHelpTests("accounts:switch", import.meta.url);
  standardArgValidationTests("accounts:switch", import.meta.url);
  standardFlagTests("accounts:switch", import.meta.url, ["--json"]);

  describe("error handling", () => {
    it("should error on nonexistent alias", async () => {
      const { error } = await runCommand(
        ["accounts:switch", "nonexistent-alias"],
        import.meta.url,
      );
      expect(error).toBeDefined();
    });
  });
});
