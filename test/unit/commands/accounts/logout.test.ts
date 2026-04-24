import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";
import { parseNdjsonLines } from "../../../helpers/ndjson.js";

describe("accounts:logout command", () => {
  standardHelpTests("accounts:logout", import.meta.url);
  standardArgValidationTests("accounts:logout", import.meta.url);

  describe("functionality", () => {
    beforeEach(() => {
      // Clear accounts to simulate no logged in state
      const mock = getMockConfigManager();
      mock.clearAccounts();
    });

    it("should output error in JSON format when no account is selected", async () => {
      const { stdout } = await runCommand(
        ["accounts:logout", "--json"],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find(
        (r) => r.type === "result" || r.type === "error",
      )!;
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      expect(result.error.message).toContain("No account");
    });
  });

  describe("with logged in account", () => {
    beforeEach(() => {
      // Set up config with a logged in account via mock
      const mock = getMockConfigManager();
      mock.setConfig({
        current: { account: "testaccount" },
        accounts: {
          testaccount: {
            accessToken: "test_token_12345",
            accountId: "acc-123",
            accountName: "Test Account",
            userEmail: "test@example.com",
          },
        },
      });
    });

    it("should successfully logout with --force and --json flags", async () => {
      const { stdout } = await runCommand(
        ["accounts:logout", "--force", "--json"],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find(
        (r) => r.type === "result" || r.type === "error",
      )!;
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("account");
      expect(result.account).toHaveProperty("alias", "testaccount");
      expect(result.account).toHaveProperty("remainingAccounts");

      // Verify config was updated - account should be removed
      const mock = getMockConfigManager();
      const config = mock.getConfig();
      expect(config.accounts["testaccount"]).toBeUndefined();
    });

    it("should logout specific account by alias with --force and --json", async () => {
      const { stdout } = await runCommand(
        ["accounts:logout", "testaccount", "--force", "--json"],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find(
        (r) => r.type === "result" || r.type === "error",
      )!;
      expect(result).toHaveProperty("success", true);
      expect(result.account).toHaveProperty("alias", "testaccount");

      // Verify config was updated - account should be removed
      const mock = getMockConfigManager();
      const config = mock.getConfig();
      expect(config.accounts["testaccount"]).toBeUndefined();
    });

    it("should logout specific account by account ID with --force and --json", async () => {
      const { stdout } = await runCommand(
        ["accounts:logout", "acc-123", "--force", "--json"],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find(
        (r) => r.type === "result" || r.type === "error",
      )!;
      expect(result).toHaveProperty("success", true);
      expect(result.account).toHaveProperty("alias", "testaccount");

      const mock = getMockConfigManager();
      const config = mock.getConfig();
      expect(config.accounts["testaccount"]).toBeUndefined();
    });
  });

  describe("with multiple logged in accounts", () => {
    beforeEach(() => {
      // Set up config with multiple accounts via mock
      const mock = getMockConfigManager();
      mock.setConfig({
        current: { account: "primary" },
        accounts: {
          primary: {
            accessToken: "primary_token",
            accountId: "acc-primary",
            accountName: "Primary Account",
            userEmail: "primary@example.com",
          },
          secondary: {
            accessToken: "secondary_token",
            accountId: "acc-secondary",
            accountName: "Secondary Account",
            userEmail: "secondary@example.com",
          },
        },
      });
    });

    it("should logout current account and show remaining accounts", async () => {
      const { stdout } = await runCommand(
        ["accounts:logout", "--force", "--json"],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find(
        (r) => r.type === "result" || r.type === "error",
      )!;
      expect(result).toHaveProperty("success", true);
      expect(result.account).toHaveProperty("alias", "primary");
      expect(result.account.remainingAccounts).toContain("secondary");

      // Verify config was updated - primary removed, secondary remains
      const mock = getMockConfigManager();
      const config = mock.getConfig();
      expect(config.accounts["primary"]).toBeUndefined();
      expect(config.accounts["secondary"]).toBeDefined();
      expect(config.accounts["secondary"].accessToken).toBe("secondary_token");
      expect(config.accounts["secondary"].accountName).toBe(
        "Secondary Account",
      );
    });

    it("should logout specific account when alias is provided", async () => {
      const { stdout } = await runCommand(
        ["accounts:logout", "secondary", "--force", "--json"],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find(
        (r) => r.type === "result" || r.type === "error",
      )!;
      expect(result).toHaveProperty("success", true);
      expect(result.account).toHaveProperty("alias", "secondary");
      expect(result.account.remainingAccounts).toContain("primary");

      // Verify config was updated - secondary removed, primary remains
      const mock = getMockConfigManager();
      const config = mock.getConfig();
      expect(config.accounts["secondary"]).toBeUndefined();
      expect(config.accounts["primary"]).toBeDefined();
      expect(config.accounts["primary"].accessToken).toBe("primary_token");
      expect(config.accounts["primary"].accountName).toBe("Primary Account");
      // Current account should still be primary
      expect(config.current?.account).toBe("primary");
    });

    it("should logout specific account by account ID", async () => {
      const { stdout } = await runCommand(
        ["accounts:logout", "acc-secondary", "--force", "--json"],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find(
        (r) => r.type === "result" || r.type === "error",
      )!;
      expect(result).toHaveProperty("success", true);
      expect(result.account).toHaveProperty("alias", "secondary");

      const mock = getMockConfigManager();
      const config = mock.getConfig();
      expect(config.accounts["secondary"]).toBeUndefined();
      expect(config.accounts["primary"]).toBeDefined();
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      // Set up config with a logged in account via mock
      const mock = getMockConfigManager();
      mock.setConfig({
        current: { account: "existingaccount" },
        accounts: {
          existingaccount: {
            accessToken: "test_token",
            accountId: "acc-123",
            accountName: "Test Account",
            userEmail: "test@example.com",
          },
        },
      });
    });

    it("should output error in JSON format when account alias does not exist", async () => {
      const { stdout } = await runCommand(
        ["accounts:logout", "nonexistent", "--json"],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find(
        (r) => r.type === "result" || r.type === "error",
      )!;
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      expect(result.error.message).toContain("not found");
    });
  });

  standardFlagTests("accounts:logout", import.meta.url, ["--json"]);
});
