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

describe("integrations:delete command", () => {
  const mockRuleId = "rule-123456";

  afterEach(() => {
    controlApiCleanup();
  });

  describe("functionality", () => {
    it("should delete an integration with --force flag", async () => {
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

      // Mock GET to fetch integration details
      nockControl()
        .get(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      // Mock DELETE endpoint
      nockControl().delete(`/v1/apps/${appId}/rules/${mockRuleId}`).reply(204);

      const { stdout } = await runCommand(
        ["integrations:delete", mockRuleId, "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("Integration rule deleted:");
      expect(stdout).toContain(mockRuleId);
    });

    it("should display integration details before deletion with --force", async () => {
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

      nockControl().delete(`/v1/apps/${appId}/rules/${mockRuleId}`).reply(204);

      const { stdout } = await runCommand(
        ["integrations:delete", mockRuleId, "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("http");
      expect(stdout).toContain(appId);
    });
  });

  describe("error handling", () => {
    standardControlApiErrorTests({
      commandArgs: ["integrations:delete", mockRuleId, "--force"],
      importMetaUrl: import.meta.url,
      setupNock: (scenario) => {
        const appId = getMockConfigManager().getCurrentAppId()!;
        const scope = nockControl().get(
          `/v1/apps/${appId}/rules/${mockRuleId}`,
        );
        if (scenario === "401") scope.reply(401, { error: "Unauthorized" });
        else if (scenario === "500")
          scope.reply(500, { error: "Internal Server Error" });
        else scope.replyWithError("Network error");
      },
    });

    it("should require ruleId argument", async () => {
      const { error } = await runCommand(
        ["integrations:delete", "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Missing.*required arg/i);
    });

    it("should handle integration not found", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(404, { error: "Not found" });

      const { error } = await runCommand(
        ["integrations:delete", mockRuleId, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Error deleting integration|404/i);
    });

    it("should handle API errors during deletion", async () => {
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

      nockControl()
        .delete(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(500, { error: "Internal server error" });

      const { error } = await runCommand(
        ["integrations:delete", mockRuleId, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Error deleting integration|500/i);
    });

    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["integrations:delete", mockRuleId, "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("flags", () => {
    it("should accept -f as shorthand for --force", async () => {
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

      nockControl().delete(`/v1/apps/${appId}/rules/${mockRuleId}`).reply(204);

      const { stdout } = await runCommand(
        ["integrations:delete", mockRuleId, "-f"],
        import.meta.url,
      );

      expect(stdout).toContain("Integration rule deleted:");
    });

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

      nockControl().delete(`/v1/apps/${appId}/rules/${mockRuleId}`).reply(204);

      const { stdout } = await runCommand(
        ["integrations:delete", mockRuleId, "--app", appId, "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("Integration rule deleted:");
    });
  });

  standardHelpTests("integrations:delete", import.meta.url);
  standardArgValidationTests("integrations:delete", import.meta.url, {
    requiredArgs: ["ruleId"],
  });
});
