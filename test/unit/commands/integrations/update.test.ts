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

describe("integrations:update command", () => {
  const mockRuleId = "rule-123456";

  afterEach(() => {
    controlApiCleanup();
  });

  describe("functionality", () => {
    it("should update channel filter", async () => {
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
      const updatedIntegration = {
        ...mockIntegration,
        source: {
          ...mockIntegration.source,
          channelFilter: "messages:*",
        },
      };

      // Mock GET to fetch existing integration
      nockControl()
        .get(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      // Mock PATCH to update integration
      nockControl()
        .patch(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(200, updatedIntegration);

      const { stdout } = await runCommand(
        ["integrations:update", mockRuleId, "--channel-filter", "messages:*"],
        import.meta.url,
      );

      expect(stdout).toContain("Integration rule updated.");
      expect(stdout).toContain(mockRuleId);
    });

    it("should update target URL for HTTP integrations", async () => {
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
      const newUrl = "https://new-example.com/webhook";
      const updatedIntegration = {
        ...mockIntegration,
        target: {
          ...mockIntegration.target,
          url: newUrl,
        },
      };

      nockControl()
        .get(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      nockControl()
        .patch(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(200, updatedIntegration);

      const { stdout } = await runCommand(
        ["integrations:update", mockRuleId, "--target-url", newUrl],
        import.meta.url,
      );

      expect(stdout).toContain("Integration rule updated.");
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
      const updatedIntegration = {
        ...mockIntegration,
        source: {
          ...mockIntegration.source,
          channelFilter: "updates:*",
        },
      };

      nockControl()
        .get(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      nockControl()
        .patch(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(200, updatedIntegration);

      const { stdout } = await runCommand(
        [
          "integrations:update",
          mockRuleId,
          "--channel-filter",
          "updates:*",
          "--json",
        ],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "integrations:update");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("rule");
      expect(result.rule).toHaveProperty("id", mockRuleId);
      expect(result.rule.created).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
      );
      expect(result.rule.modified).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
      );
    });

    it("should update request mode", async () => {
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
      const updatedIntegration = {
        ...mockIntegration,
        requestMode: "batch",
      };

      nockControl()
        .get(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      nockControl()
        .patch(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(200, updatedIntegration);

      const { stdout } = await runCommand(
        [
          "integrations:update",
          mockRuleId,
          "--request-mode",
          "batch",
          "--json",
        ],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "integrations:update");
      expect(result).toHaveProperty("success", true);
      expect(result.rule).toHaveProperty("requestMode", "batch");
    });
  });

  describe("error handling", () => {
    standardControlApiErrorTests({
      commandArgs: [
        "integrations:update",
        mockRuleId,
        "--channel-filter",
        "test:*",
      ],
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
        ["integrations:update", "--channel-filter", "test:*"],
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
        ["integrations:update", mockRuleId, "--channel-filter", "test:*"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Error updating integration|404/i);
    });

    it("should handle API errors during update", async () => {
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
        .patch(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(400, { error: "Invalid update" });

      const { error } = await runCommand(
        ["integrations:update", mockRuleId, "--channel-filter", "test:*"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Error updating integration|400/i);
    });

    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["integrations:update", mockRuleId, "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("flags", () => {
    it("should accept --app flag", async () => {
      const mockConfig = getMockConfigManager();
      const appId = mockConfig.getCurrentAppId()!;
      const accountId = mockConfig.getCurrentAccount()!.accountId!;
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
      const updatedIntegration = {
        ...mockIntegration,
        source: {
          ...mockIntegration.source,
          channelFilter: "new:*",
        },
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

      nockControl()
        .patch(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(200, updatedIntegration);

      const { stdout } = await runCommand(
        [
          "integrations:update",
          mockRuleId,
          "--app",
          appId,
          "--channel-filter",
          "new:*",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Integration rule updated.");
    });
  });

  standardHelpTests("integrations:update", import.meta.url);
  standardArgValidationTests("integrations:update", import.meta.url, {
    requiredArgs: ["ruleId"],
  });
});
