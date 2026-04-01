import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import {
  nockControl,
  controlApiCleanup,
} from "../../../helpers/control-api-test-helpers.js";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardControlApiErrorTests,
} from "../../../helpers/standard-tests.js";

describe("integrations:get command", () => {
  const mockRuleId = "rule-123456";

  afterEach(() => {
    controlApiCleanup();
  });

  describe("functionality", () => {
    it("should get an integration by ID", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockIntegration = {
        id: mockRuleId,
        appId,
        ruleType: "http",
        requestMode: "single",
        source: {
          channelFilter: "chat:*",
          type: "channel.message",
        },
        target: {
          url: "https://example.com/webhook",
          format: "json",
          enveloped: true,
        },
        status: "enabled",
        version: "1.0",
        created: Date.now(),
        modified: Date.now(),
      };

      nockControl()
        .get(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      const { stdout } = await runCommand(
        ["integrations:get", mockRuleId],
        import.meta.url,
      );

      expect(stdout).toContain("Integration Rule Details");
      expect(stdout).toContain(mockRuleId);
      expect(stdout).toContain(appId);
      expect(stdout).toContain("http");
      expect(stdout).toContain("channel.message");
    });

    it("should output JSON format when --json flag is used", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockIntegration = {
        id: mockRuleId,
        appId,
        ruleType: "http",
        requestMode: "single",
        source: {
          channelFilter: "chat:*",
          type: "channel.message",
        },
        target: {
          url: "https://example.com/webhook",
          format: "json",
          enveloped: true,
        },
        status: "enabled",
        version: "1.0",
        created: Date.now(),
        modified: Date.now(),
      };

      nockControl()
        .get(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      const { stdout } = await runCommand(
        ["integrations:get", mockRuleId, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("rule");
      expect(result.rule).toHaveProperty("id", mockRuleId);
      expect(result.rule).toHaveProperty("appId", appId);
      expect(result.rule).toHaveProperty("ruleType", "http");
      expect(result.rule).toHaveProperty("source");
      expect(result.rule.source).toHaveProperty("type", "channel.message");
      expect(result.rule.created).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
      );
      expect(result.rule.modified).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
      );
    });

    it("should output pretty JSON when --pretty-json flag is used", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockIntegration = {
        id: mockRuleId,
        appId,
        ruleType: "http",
        requestMode: "single",
        source: {
          channelFilter: "chat:*",
          type: "channel.message",
        },
        target: {
          url: "https://example.com/webhook",
          format: "json",
          enveloped: true,
        },
        status: "enabled",
        version: "1.0",
        created: Date.now(),
        modified: Date.now(),
      };

      nockControl()
        .get(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      const { stdout } = await runCommand(
        ["integrations:get", mockRuleId, "--pretty-json"],
        import.meta.url,
      );

      // Pretty JSON should have newlines
      expect(stdout).toContain("\n");
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("rule");
      expect(result.rule).toHaveProperty("id", mockRuleId);
    });

    it("should display channel filter", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockIntegration = {
        id: mockRuleId,
        appId,
        ruleType: "http",
        requestMode: "single",
        source: {
          channelFilter: "chat:*",
          type: "channel.message",
        },
        target: {
          url: "https://example.com/webhook",
          format: "json",
          enveloped: true,
        },
        status: "enabled",
        version: "1.0",
        created: Date.now(),
        modified: Date.now(),
      };

      nockControl()
        .get(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      const { stdout } = await runCommand(
        ["integrations:get", mockRuleId],
        import.meta.url,
      );

      expect(stdout).toContain("chat:*");
    });

    it("should display target information", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockIntegration = {
        id: mockRuleId,
        appId,
        ruleType: "http",
        requestMode: "single",
        source: {
          channelFilter: "chat:*",
          type: "channel.message",
        },
        target: {
          url: "https://example.com/webhook",
          format: "json",
          enveloped: true,
        },
        status: "enabled",
        version: "1.0",
        created: Date.now(),
        modified: Date.now(),
      };

      nockControl()
        .get(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      const { stdout } = await runCommand(
        ["integrations:get", mockRuleId],
        import.meta.url,
      );

      expect(stdout).toContain("Target:");
      expect(stdout).toContain("https://example.com/webhook");
    });
  });

  describe("error handling", () => {
    it("should require ruleId argument", async () => {
      const { error } = await runCommand(["integrations:get"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Missing.*required arg/i);
    });

    it("should handle integration not found", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(404, { error: "Not found" });

      const { error } = await runCommand(
        ["integrations:get", mockRuleId],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Error getting integration|404/i);
    });

    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["integrations:get", mockRuleId, "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/unknown|Nonexistent flag/i);
    });

    standardControlApiErrorTests({
      commandArgs: ["integrations:get", "rule-123456"],
      importMetaUrl: import.meta.url,
      setupNock: (scenario) => {
        const appId = getMockConfigManager().getCurrentAppId()!;
        const scope = nockControl().get(`/v1/apps/${appId}/rules/rule-123456`);
        if (scenario === "401") scope.reply(401, { error: "Unauthorized" });
        else if (scenario === "500")
          scope.reply(500, { error: "Internal Server Error" });
        else scope.replyWithError("Network error");
      },
    });
  });

  describe("flags", () => {
    it("should accept --app flag", async () => {
      const mockConfig = getMockConfigManager();
      const appId = mockConfig.getCurrentAppId()!;
      const accountId = mockConfig.getCurrentAccount()!.accountId;
      const mockIntegration = {
        id: mockRuleId,
        appId,
        ruleType: "http",
        requestMode: "single",
        source: {
          channelFilter: "chat:*",
          type: "channel.message",
        },
        target: {
          url: "https://example.com/webhook",
          format: "json",
          enveloped: true,
        },
        status: "enabled",
        version: "1.0",
        created: Date.now(),
        modified: Date.now(),
      };

      // Mock the /me endpoint (needed by listApps in resolveAppIdFromNameOrId)
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the apps list API call for resolveAppIdFromNameOrId
      nockControl()
        .get(`/v1/accounts/${accountId}/apps`)
        .reply(200, [{ id: appId, name: "Test App", accountId }]);

      nockControl()
        .get(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      const { stdout } = await runCommand(
        ["integrations:get", mockRuleId, "--app", appId],
        import.meta.url,
      );

      expect(stdout).toContain("Integration Rule Details");
      expect(stdout).toContain(mockRuleId);
    });
  });

  standardHelpTests("integrations:get", import.meta.url);
  standardArgValidationTests("integrations:get", import.meta.url, {
    requiredArgs: ["ruleId"],
  });
});
