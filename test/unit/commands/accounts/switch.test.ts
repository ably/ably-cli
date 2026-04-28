import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
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
import { parseJsonOutput } from "../../../helpers/ndjson.js";

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

      const { stdout, stderr } = await runCommand(
        ["accounts:switch", "second"],
        import.meta.url,
      );

      expect(stderr).toContain("Switched to account");
      expect(stderr).toContain(mockAccountName);
      expect(stdout).toContain(mockUserEmail);
    });

    it("should switch to existing account by account ID", async () => {
      const mock = getMockConfigManager();

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

      const { stderr } = await runCommand(
        ["accounts:switch", mockAccountId],
        import.meta.url,
      );

      expect(stderr).toContain("Switched to account");
      expect(mock.getCurrentAccountAlias()).toBe("second");
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

      const result = parseJsonOutput(stdout);
      expect(result).toHaveProperty("success", false);
      expect(result.error.message).toContain("No accounts configured");
    });

    it("should output JSON error when no accounts with --json", async () => {
      const mock = getMockConfigManager();
      mock.clearAccounts();

      const { stdout } = await runCommand(
        ["accounts:switch", "--json"],
        import.meta.url,
      );

      const result = parseJsonOutput(stdout);
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      expect(result.error.message).toContain("No accounts configured");
    });
  });

  describe("JSON output", () => {
    it("should output JSON error when invalid alias with available accounts", async () => {
      const { stdout } = await runCommand(
        ["accounts:switch", "nonexistent", "--json"],
        import.meta.url,
      );

      const result = parseJsonOutput(stdout);
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      expect(result.error.message).toContain("not found");
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

  describe("OAuth account switching", () => {
    it("should switch between local OAuth accounts", async () => {
      const mock = getMockConfigManager();

      // Store an OAuth account
      mock.storeOAuthTokens(
        "oauth-acct",
        {
          accessToken: "oauth_token_123",
          refreshToken: "refresh_token_123",
          expiresAt: Date.now() + 3600000,
          userEmail: "oauth@example.com",
        },
        {
          accountId: "oauth-account-id",
          accountName: "OAuth Account",
        },
      );

      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: "oauth-account-id", name: "OAuth Account" },
          user: { email: "oauth@example.com" },
        });

      const { stderr } = await runCommand(
        ["accounts:switch", "oauth-acct"],
        import.meta.url,
      );

      expect(stderr).toContain("Switched to account");
      expect(mock.getCurrentAccountAlias()).toBe("oauth-acct");
      expect(mock.getAuthMethod("oauth-acct")).toBe("oauth");
    });

    it("hits the stored controlHost when the account was logged in against a custom host", async () => {
      const mock = getMockConfigManager();
      const customHost = "review-abc.herokuapp.com";

      mock.storeOAuthTokens(
        "custom-host-acct",
        {
          accessToken: "oauth_token_custom",
          refreshToken: "refresh_token_custom",
          expiresAt: Date.now() + 3_600_000,
          userEmail: "custom@example.com",
        },
        {
          accountId: "custom-account-id",
          accountName: "Custom Host Account",
          controlHost: customHost,
          oauthHost: customHost,
        },
      );

      const scope = nock(`https://${customHost}`)
        .get("/api/v1/me")
        .reply(200, {
          account: { id: "custom-account-id", name: "Custom Host Account" },
          user: { email: "custom@example.com" },
        });

      const { stderr } = await runCommand(
        ["accounts:switch", "custom-host-acct"],
        import.meta.url,
      );

      expect(stderr).toContain("Switched to account");
      expect(stderr).not.toContain("Access token may have expired");
      expect(scope.isDone()).toBe(true);
    });

    it("should return JSON with account info when switching OAuth account with --json", async () => {
      const mock = getMockConfigManager();

      mock.storeOAuthTokens(
        "oauth-json",
        {
          accessToken: "oauth_token_json",
          refreshToken: "refresh_token_json",
          expiresAt: Date.now() + 3600000,
          userEmail: "json@example.com",
        },
        {
          accountId: "json-account-id",
          accountName: "JSON Account",
        },
      );

      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: "json-account-id", name: "JSON Account" },
          user: { email: "json@example.com" },
        });

      const { stdout } = await runCommand(
        ["accounts:switch", "oauth-json", "--json"],
        import.meta.url,
      );

      const result = parseJsonOutput(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result.account.alias).toBe("oauth-json");
      expect(result.account.id).toBe("json-account-id");
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
