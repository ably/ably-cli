import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";

describe("integrations:delete command", () => {
  const mockRuleId = "rule-123456";

  afterEach(() => {
    nock.cleanAll();
  });

  describe("successful integration deletion", () => {
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
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      // Mock DELETE endpoint
      nock("https://control.ably.net")
        .delete(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(204);

      const { stdout } = await runCommand(
        ["integrations:delete", mockRuleId, "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("Integration deleted successfully");
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

      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      nock("https://control.ably.net")
        .delete(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(204);

      const { stdout } = await runCommand(
        ["integrations:delete", mockRuleId, "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("http");
      expect(stdout).toContain(appId);
    });
  });

  describe("error handling", () => {
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
      nock("https://control.ably.net")
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

      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      nock("https://control.ably.net")
        .delete(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(500, { error: "Internal server error" });

      const { error } = await runCommand(
        ["integrations:delete", mockRuleId, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Error deleting integration|500/i);
    });

    it("should handle 401 authentication error", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["integrations:delete", mockRuleId, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/401/);
    });

    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["integrations:delete", mockRuleId, "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("flag options", () => {
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

      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      nock("https://control.ably.net")
        .delete(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(204);

      const { stdout } = await runCommand(
        ["integrations:delete", mockRuleId, "-f"],
        import.meta.url,
      );

      expect(stdout).toContain("Integration deleted successfully");
    });

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

      // Mock the /me endpoint (needed by listApps in resolveAppIdFromNameOrId)
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the apps list API call for resolveAppIdFromNameOrId
      nock("https://control.ably.net")
        .get(`/v1/accounts/${accountId}/apps`)
        .reply(200, [{ id: appId, name: "Test App", accountId }]);

      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      nock("https://control.ably.net")
        .delete(`/v1/apps/${appId}/rules/${mockRuleId}`)
        .reply(204);

      const { stdout } = await runCommand(
        ["integrations:delete", mockRuleId, "--app", appId, "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("Integration deleted successfully");
    });
  });
});
