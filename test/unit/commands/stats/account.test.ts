import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  nockControl,
  controlApiCleanup,
} from "../../../helpers/control-api-test-helpers.js";
import { runCommand } from "@oclif/test";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
  standardControlApiErrorTests,
} from "../../../helpers/standard-tests.js";
import { parseNdjsonLines } from "../../../helpers/ndjson.js";
import { mockStats as mockStatsFactory } from "../../../fixtures/control-api.js";

describe("stats:account command", () => {
  const mockAccessToken = "fake_access_token";
  const mockAccountId = "test-account-id";
  const mockStatsData = [
    mockStatsFactory({
      all: {
        messages: { count: 200, data: 10000 },
        all: { count: 200, data: 10000 },
      },
    }),
  ];

  beforeEach(() => {
    process.env.ABLY_ACCESS_TOKEN = mockAccessToken;
  });

  afterEach(() => {
    controlApiCleanup();
    delete process.env.ABLY_ACCESS_TOKEN;
  });

  function mockMeEndpoint() {
    // Called once for showAuthInfoIfNeeded, once for runOneTimeStats
    nockControl()
      .get("/v1/me")
      .times(2)
      .reply(200, {
        account: { id: mockAccountId, name: "Test Account" },
        user: { email: "test@example.com" },
      });
  }

  standardHelpTests("stats:account", import.meta.url);
  standardArgValidationTests("stats:account", import.meta.url);
  standardFlagTests("stats:account", import.meta.url, [
    "--json",
    "--start",
    "--end",
    "--limit",
    "--unit",
  ]);

  describe("functionality", () => {
    it("should display account stats successfully", async () => {
      mockMeEndpoint();
      const scope = nockControl()
        .get(`/v1/accounts/${mockAccountId}/stats`)
        .query(true)
        .reply(200, mockStatsData);

      const { stdout, error } = await runCommand(
        ["stats:account", "--start", "1h"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      expect(scope.isDone()).toBe(true);
      expect(stdout).toContain("2023-01-01");
    });

    it("should accept ISO 8601 for --start and --end", async () => {
      mockMeEndpoint();
      const scope = nockControl()
        .get(`/v1/accounts/${mockAccountId}/stats`)
        .query(true)
        .reply(200, mockStatsData);

      const { stdout } = await runCommand(
        [
          "stats:account",
          "--start",
          "2023-01-01T00:00:00Z",
          "--end",
          "2023-01-02T00:00:00Z",
        ],
        import.meta.url,
      );

      expect(scope.isDone()).toBe(true);
      expect(stdout).toContain("2023-01-01");
    });

    it("should accept relative time for --start", async () => {
      mockMeEndpoint();
      const scope = nockControl()
        .get(`/v1/accounts/${mockAccountId}/stats`)
        .query(true)
        .reply(200, mockStatsData);

      const { stdout } = await runCommand(
        ["stats:account", "--start", "1h"],
        import.meta.url,
      );

      expect(scope.isDone()).toBe(true);
      expect(stdout).toContain("2023-01-01");
    });

    it("should accept Unix ms for --start", async () => {
      mockMeEndpoint();
      const scope = nockControl()
        .get(`/v1/accounts/${mockAccountId}/stats`)
        .query(true)
        .reply(200, mockStatsData);

      const { stdout } = await runCommand(
        ["stats:account", "--start", "1672531200000"],
        import.meta.url,
      );

      expect(scope.isDone()).toBe(true);
      expect(stdout).toContain("2023-01-01");
    });
  });

  describe("error handling", () => {
    standardControlApiErrorTests({
      commandArgs: ["stats:account"],
      importMetaUrl: import.meta.url,
      setupNock: (scenario) => {
        const scope = nockControl().get("/v1/me").times(2);
        if (scenario === "401") scope.reply(401, { error: "Unauthorized" });
        else if (scenario === "500")
          scope.reply(500, { error: "Internal Server Error" });
        else scope.replyWithError("Network error");
      },
    });
  });

  describe("querying stats for a specific account", () => {
    const altAlias = "altaccount";
    const altAccountId = "alt-account-id";
    const altAccountName = "Alt Account";
    const altToken = "alt_access_token";

    beforeEach(() => {
      // Do NOT set ABLY_ACCESS_TOKEN — it overrides config-based tokens
      delete process.env.ABLY_ACCESS_TOKEN;
      controlApiCleanup();
      getMockConfigManager().storeAccount(altToken, altAlias, {
        accountId: altAccountId,
        accountName: altAccountName,
        userEmail: "alt@example.com",
      });
    });

    afterEach(() => {
      controlApiCleanup();
    });

    it("should query stats for a specific account by alias", async () => {
      // getStatsLabel + getAccountStats both call /v1/me
      nockControl()
        .get("/v1/me")
        .times(2)
        .reply(200, {
          account: { id: altAccountId, name: altAccountName },
          user: { email: "alt@example.com" },
        });

      const scope = nockControl()
        .get(`/v1/accounts/${altAccountId}/stats`)
        .query(true)
        .reply(200, mockStatsData);

      const { stdout, error } = await runCommand(
        ["stats:account", altAlias, "--start", "1h"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      expect(scope.isDone()).toBe(true);
      expect(stdout).toContain("2023-01-01");
    });

    it("should query stats for a specific account by account ID", async () => {
      nockControl()
        .get("/v1/me")
        .times(2)
        .reply(200, {
          account: { id: altAccountId, name: altAccountName },
          user: { email: "alt@example.com" },
        });

      const scope = nockControl()
        .get(`/v1/accounts/${altAccountId}/stats`)
        .query(true)
        .reply(200, mockStatsData);

      const { stdout, error } = await runCommand(
        ["stats:account", altAccountId, "--start", "1h"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      expect(scope.isDone()).toBe(true);
      expect(stdout).toContain("2023-01-01");
    });

    it("should error when account not found", async () => {
      const { stdout } = await runCommand(
        ["stats:account", "nonexistent", "--json"],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find(
        (r) => r.type === "result" || r.type === "error",
      )!;
      expect(result).toHaveProperty("success", false);
      expect(result.error.message).toContain("not found");
    });

    it("should error when account has no access token", async () => {
      getMockConfigManager().setConfig({
        current: { account: altAlias },
        accounts: {
          [altAlias]: {
            accessToken: "",
            accountId: altAccountId,
            accountName: altAccountName,
            userEmail: "alt@example.com",
          },
        },
      });

      const { stdout } = await runCommand(
        ["stats:account", altAlias, "--json"],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find(
        (r) => r.type === "result" || r.type === "error",
      )!;
      expect(result).toHaveProperty("success", false);
      expect(result.error.message).toContain("No access token");
    });
  });
});
