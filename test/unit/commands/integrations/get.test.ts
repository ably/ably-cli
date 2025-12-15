import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { DEFAULT_TEST_CONFIG } from "../../../helpers/mock-config-manager.js";

describe("integrations:get command", () => {
  const mockAppId = DEFAULT_TEST_CONFIG.appId;
  const mockAccountId = DEFAULT_TEST_CONFIG.accountId;
  const mockRuleId = "rule-123456";

  afterEach(() => {
    nock.cleanAll();
  });

  const mockIntegration = {
    id: mockRuleId,
    appId: mockAppId,
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

  describe("successful integration retrieval", () => {
    it("should get an integration by ID", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      const { stdout } = await runCommand(
        ["integrations:get", mockRuleId],
        import.meta.url,
      );

      expect(stdout).toContain("Integration Rule Details");
      expect(stdout).toContain(mockRuleId);
      expect(stdout).toContain(mockAppId);
      expect(stdout).toContain("http");
      expect(stdout).toContain("channel.message");
    });

    it("should output JSON format when --json flag is used", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      const { stdout } = await runCommand(
        ["integrations:get", mockRuleId, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("id", mockRuleId);
      expect(result).toHaveProperty("appId", mockAppId);
      expect(result).toHaveProperty("ruleType", "http");
      expect(result).toHaveProperty("source");
      expect(result.source).toHaveProperty("type", "channel.message");
    });

    it("should output pretty JSON when --pretty-json flag is used", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      const { stdout } = await runCommand(
        ["integrations:get", mockRuleId, "--pretty-json"],
        import.meta.url,
      );

      // Pretty JSON should have newlines
      expect(stdout).toContain("\n");
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("id", mockRuleId);
    });

    it("should display channel filter", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      const { stdout } = await runCommand(
        ["integrations:get", mockRuleId],
        import.meta.url,
      );

      expect(stdout).toContain("chat:*");
    });

    it("should display target information", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      const { stdout } = await runCommand(
        ["integrations:get", mockRuleId],
        import.meta.url,
      );

      expect(stdout).toContain("Target:");
      expect(stdout).toContain('"url": "https://example.com/webhook"');
    });
  });

  describe("error handling", () => {
    it("should require ruleId argument", async () => {
      const { error } = await runCommand(["integrations:get"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Missing.*required arg/i);
    });

    it("should handle integration not found", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/rules/${mockRuleId}`)
        .reply(404, { error: "Not found" });

      const { error } = await runCommand(
        ["integrations:get", mockRuleId],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Error getting integration|404/i);
    });

    it("should handle API errors", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/rules/${mockRuleId}`)
        .reply(500, { error: "Internal server error" });

      const { error } = await runCommand(
        ["integrations:get", mockRuleId],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Error getting integration|500/i);
    });

    it("should handle 401 authentication error", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/rules/${mockRuleId}`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["integrations:get", mockRuleId],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/401/);
    });

    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["integrations:get", mockRuleId, "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("flag options", () => {
    it("should accept --app flag", async () => {
      // Mock the /me endpoint (needed by listApps in resolveAppIdFromNameOrId)
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the apps list API call for resolveAppIdFromNameOrId
      nock("https://control.ably.net")
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, [
          { id: mockAppId, name: "Test App", accountId: mockAccountId },
        ]);

      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      const { stdout } = await runCommand(
        ["integrations:get", mockRuleId, "--app", mockAppId],
        import.meta.url,
      );

      expect(stdout).toContain("Integration Rule Details");
      expect(stdout).toContain(mockRuleId);
    });
  });
});
