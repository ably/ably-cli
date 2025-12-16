import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";

describe("integrations:create command", () => {
  const mockRuleId = "rule-123456";

  afterEach(() => {
    nock.cleanAll();
  });

  describe("successful integration creation", () => {
    it("should create an HTTP integration successfully", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/rules`)
        .reply(201, {
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
          },
          status: "enabled",
        });

      const { stdout } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "http",
          "--source-type",
          "channel.message",
          "--channel-filter",
          "chat:*",
          "--target-url",
          "https://example.com/webhook",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Integration created successfully");
      expect(stdout).toContain(mockRuleId);
      expect(stdout).toContain("http");
    });

    it("should create an AMQP integration successfully", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/rules`)
        .reply(201, {
          id: mockRuleId,
          appId,
          ruleType: "amqp",
          requestMode: "single",
          source: {
            channelFilter: "",
            type: "channel.message",
          },
          target: {
            enveloped: true,
            format: "json",
            exchangeName: "ably",
          },
          status: "enabled",
        });

      const { stdout } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "amqp",
          "--source-type",
          "channel.message",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Integration created successfully");
      expect(stdout).toContain("amqp");
    });

    it("should create a disabled integration when status is disabled", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/rules`, (body: Record<string, unknown>) => {
          return body.status === "disabled";
        })
        .reply(201, {
          id: mockRuleId,
          appId,
          ruleType: "http",
          requestMode: "single",
          source: {
            channelFilter: "",
            type: "channel.message",
          },
          target: {
            url: "https://example.com/webhook",
          },
          status: "disabled",
        });

      const { stdout } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "http",
          "--source-type",
          "channel.message",
          "--target-url",
          "https://example.com/webhook",
          "--status",
          "disabled",
          "--json",
        ],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result.integration).toHaveProperty("status", "disabled");
    });

    it("should create integration with batch request mode", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/rules`, (body: Record<string, unknown>) => {
          return body.requestMode === "batch";
        })
        .reply(201, {
          id: mockRuleId,
          appId,
          ruleType: "http",
          requestMode: "batch",
          source: {
            channelFilter: "",
            type: "channel.message",
          },
          target: {
            url: "https://example.com/webhook",
          },
          status: "enabled",
        });

      const { stdout } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "http",
          "--source-type",
          "channel.message",
          "--target-url",
          "https://example.com/webhook",
          "--request-mode",
          "batch",
          "--json",
        ],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result.integration).toHaveProperty("requestMode", "batch");
    });

    it("should output JSON format when --json flag is used", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/rules`)
        .reply(201, {
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
          },
          status: "enabled",
        });

      const { stdout } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "http",
          "--source-type",
          "channel.message",
          "--channel-filter",
          "chat:*",
          "--target-url",
          "https://example.com/webhook",
          "--json",
        ],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("integration");
      expect(result.integration).toHaveProperty("id", mockRuleId);
      expect(result.integration).toHaveProperty("ruleType", "http");
    });
  });

  describe("error handling", () => {
    it("should require rule-type flag", async () => {
      const { error } = await runCommand(
        [
          "integrations:create",
          "--source-type",
          "channel.message",
          "--channel-filter",
          "chat:*",
          "--target-url",
          "https://example.com/webhook",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Missing required flag.*rule-type/i);
    });

    it("should require source-type flag", async () => {
      const { error } = await runCommand(
        ["integrations:create", "--rule-type", "http"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Missing required flag.*source-type/i);
    });

    it("should require target-url for HTTP integrations", async () => {
      const { error } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "http",
          "--source-type",
          "channel.message",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/target-url.*required.*HTTP/i);
    });

    it("should handle API errors", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/rules`)
        .reply(400, { error: "Invalid configuration" });

      const { error } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "http",
          "--source-type",
          "channel.message",
          "--channel-filter",
          "chat:*",
          "--target-url",
          "https://example.com/webhook",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/400/);
    });

    it("should handle 401 authentication error", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/rules`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "http",
          "--source-type",
          "channel.message",
          "--channel-filter",
          "chat:*",
          "--target-url",
          "https://example.com/webhook",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/401/);
    });

    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["integrations:create", "--rule-type", "http", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("source type options", () => {
    it("should accept channel.presence source type", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/rules`)
        .reply(201, {
          id: mockRuleId,
          appId,
          ruleType: "http",
          requestMode: "single",
          source: {
            channelFilter: "",
            type: "channel.presence",
          },
          target: {
            url: "https://example.com/webhook",
          },
          status: "enabled",
        });

      const { stdout } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "http",
          "--source-type",
          "channel.presence",
          "--target-url",
          "https://example.com/webhook",
          "--json",
        ],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result.integration.source.type).toBe("channel.presence");
    });

    it("should accept channel.lifecycle source type", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/rules`)
        .reply(201, {
          id: mockRuleId,
          appId,
          ruleType: "http",
          requestMode: "single",
          source: {
            channelFilter: "",
            type: "channel.lifecycle",
          },
          target: {
            url: "https://example.com/webhook",
          },
          status: "enabled",
        });

      const { stdout } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "http",
          "--source-type",
          "channel.lifecycle",
          "--target-url",
          "https://example.com/webhook",
          "--json",
        ],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result.integration.source.type).toBe("channel.lifecycle");
    });
  });
});
