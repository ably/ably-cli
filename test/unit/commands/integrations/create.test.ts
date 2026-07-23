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
  standardFlagTests,
  standardControlApiErrorTests,
} from "../../../helpers/standard-tests.js";
import { parseNdjsonLines } from "../../../helpers/ndjson.js";

describe("integrations:create command", () => {
  const mockRuleId = "rule-123456";

  afterEach(() => {
    controlApiCleanup();
  });

  describe("functionality", () => {
    it("should create an HTTP integration successfully", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .post(`/v1/apps/${appId}/rules`)
        .reply(201, {
          id: mockRuleId,
          appId,
          ruleType: "http",
          requestMode: "single",
          source: {
            channelFilter: "chat:.*",
            type: "channel.message",
          },
          target: {
            url: "https://example.com/webhook",
            format: "json",
          },
          status: "enabled",
        });

      const { stdout, stderr } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "http",
          "--source-type",
          "channel.message",
          "--channel-filter",
          "chat:.*",
          "--target-url",
          "https://example.com/webhook",
        ],
        import.meta.url,
      );

      expect(stderr).toContain("Integration rule created:");
      expect(stdout).toContain(mockRuleId);
      expect(stdout).toContain("http");
    });

    it("should display chat room filter in human-readable output", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .post(`/v1/apps/${appId}/rules`)
        .reply(201, {
          id: mockRuleId,
          appId,
          ruleType: "http/before-publish",
          invocationMode: "BEFORE_PUBLISH",
          beforePublishConfig: {
            retryTimeout: 3000,
            maxRetries: 3,
            failedAction: "REJECT",
            tooManyRequestsAction: "RETRY",
          },
          chatRoomFilter: "room:.*",
          source: {
            type: "chat.message",
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
          "http/before-publish",
          "--source-type",
          "chat.message",
          "--chat-room-filter",
          "room:.*",
          "--target-url",
          "https://example.com/webhook",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Chat Room Filter");
      expect(stdout).toContain("room:.*");
      expect(stdout).toContain("Invocation Mode");
      expect(stdout).toContain("BEFORE_PUBLISH");
    });

    it("should create an AMQP integration successfully", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
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

      const { stdout, stderr } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "amqp",
          "--source-type",
          "channel.message",
        ],
        import.meta.url,
      );

      expect(stderr).toContain("Integration rule created:");
      expect(stdout).toContain("amqp");
    });

    it("should create a disabled integration when status is disabled", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
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
          created: 1640995200000,
          modified: 1640995200000,
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

      const result = parseNdjsonLines(stdout).find((r) => r.type === "result")!;
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "integrations:create");
      expect(result).toHaveProperty("success", true);
      expect(result.integration).toHaveProperty("status", "disabled");
    });

    it("should create integration with batch request mode", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
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
          created: 1640995200000,
          modified: 1640995200000,
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

      const result = parseNdjsonLines(stdout).find((r) => r.type === "result")!;
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "integrations:create");
      expect(result).toHaveProperty("success", true);
      expect(result.integration).toHaveProperty("requestMode", "batch");
    });

    it("should output JSON format when --json flag is used", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .post(`/v1/apps/${appId}/rules`)
        .reply(201, {
          id: mockRuleId,
          appId,
          ruleType: "http",
          requestMode: "single",
          source: {
            channelFilter: "chat:.*",
            type: "channel.message",
          },
          target: {
            url: "https://example.com/webhook",
            format: "json",
          },
          status: "enabled",
          created: 1640995200000,
          modified: 1640995200000,
        });

      const { stdout } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "http",
          "--source-type",
          "channel.message",
          "--channel-filter",
          "chat:.*",
          "--target-url",
          "https://example.com/webhook",
          "--json",
        ],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find((r) => r.type === "result")!;
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "integrations:create");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("integration");
      expect(result.integration).toHaveProperty("id", mockRuleId);
      expect(result.integration).toHaveProperty("ruleType", "http");
      expect(result.integration.created).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
      );
      expect(result.integration.modified).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
      );
    });
  });

  describe("error handling", () => {
    standardControlApiErrorTests({
      commandArgs: [
        "integrations:create",
        "--rule-type",
        "http",
        "--source-type",
        "channel.message",
        "--channel-filter",
        "chat:.*",
        "--target-url",
        "https://example.com/webhook",
      ],
      importMetaUrl: import.meta.url,
      setupNock: (scenario) => {
        const appId = getMockConfigManager().getCurrentAppId()!;
        const scope = nockControl().post(`/v1/apps/${appId}/rules`);
        if (scenario === "401") scope.reply(401, { error: "Unauthorized" });
        else if (scenario === "500")
          scope.reply(500, { error: "Internal Server Error" });
        else scope.replyWithError("Network error");
      },
    });

    it("should require rule-type flag", async () => {
      const { error } = await runCommand(
        [
          "integrations:create",
          "--source-type",
          "channel.message",
          "--channel-filter",
          "chat:.*",
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
      nockControl()
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
          "chat:.*",
          "--target-url",
          "https://example.com/webhook",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/400/);
    });

    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["integrations:create", "--rule-type", "http", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("source type options", () => {
    it("should accept channel.presence source type", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
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
          created: 1640995200000,
          modified: 1640995200000,
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

      const result = parseNdjsonLines(stdout).find((r) => r.type === "result")!;
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "integrations:create");
      expect(result).toHaveProperty("success", true);
      const integration = result.integration as Record<string, unknown>;
      const source = integration.source as Record<string, unknown>;
      expect(source.type).toBe("channel.presence");
    });

    it("should accept channel.lifecycle source type", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
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
          created: 1640995200000,
          modified: 1640995200000,
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

      const result = parseNdjsonLines(stdout).find((r) => r.type === "result")!;
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "integrations:create");
      expect(result).toHaveProperty("success", true);
      const integration = result.integration as Record<string, unknown>;
      const source = integration.source as Record<string, unknown>;
      expect(source.type).toBe("channel.lifecycle");
    });

    it("should accept chat.message source type with a chat room filter", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .post(`/v1/apps/${appId}/rules`, (body: Record<string, unknown>) => {
          const source = body.source as Record<string, unknown>;
          return (
            body.chatRoomFilter === "room:.*" &&
            !("channelFilter" in source) &&
            body.requestMode === undefined
          );
        })
        .reply(201, {
          id: mockRuleId,
          appId,
          ruleType: "http/before-publish",
          invocationMode: "BEFORE_PUBLISH",
          beforePublishConfig: {
            retryTimeout: 3000,
            maxRetries: 3,
            failedAction: "REJECT",
            tooManyRequestsAction: "RETRY",
          },
          chatRoomFilter: "room:.*",
          source: {
            type: "chat.message",
          },
          target: {
            url: "https://example.com/webhook",
          },
          status: "enabled",
          created: 1640995200000,
          modified: 1640995200000,
        });

      const { stdout } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "http/before-publish",
          "--source-type",
          "chat.message",
          "--chat-room-filter",
          "room:.*",
          "--target-url",
          "https://example.com/webhook",
          "--json",
        ],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find((r) => r.type === "result")!;
      expect(result).toHaveProperty("success", true);
      const integration = result.integration as Record<string, unknown>;
      expect(integration).toHaveProperty("chatRoomFilter", "room:.*");
      const source = integration.source as Record<string, unknown>;
      expect(source.type).toBe("chat.message");
    });
  });

  describe("chat rule types", () => {
    it("should reject a --threshold value with an empty number", async () => {
      const { error } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "hive/text-model-only",
          "--source-type",
          "chat.message",
          "--target-api-key",
          "hive-key",
          "--threshold",
          "bullying=",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Invalid --threshold value "bullying="/);
    });

    it("should reject a --threshold value with more than one '='", async () => {
      const { error } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "hive/text-model-only",
          "--source-type",
          "chat.message",
          "--target-api-key",
          "hive-key",
          "--threshold",
          "bullying=2=3",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(
        /Invalid --threshold value "bullying=2=3"/,
      );
    });

    it("should reject a chat rule type combined with a non-chat.message source type", async () => {
      const { error } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "http/before-publish",
          "--source-type",
          "channel.message",
          "--target-url",
          "https://example.com/webhook",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(
        /--source-type must be "chat.message" for http\/before-publish/,
      );
    });

    it("should reject a channel rule type combined with chat.message source type", async () => {
      const { error } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "http",
          "--source-type",
          "chat.message",
          "--target-url",
          "https://example.com/webhook",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(
        /"chat.message" requires a chat rule type/,
      );
    });

    it("should create a hive/text-model-only rule with thresholds and beforePublishConfig", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .post(`/v1/apps/${appId}/rules`, (body: Record<string, unknown>) => {
          const target = body.target as Record<string, unknown>;
          return (
            body.invocationMode === "BEFORE_PUBLISH" &&
            JSON.stringify(body.beforePublishConfig) ===
              JSON.stringify({
                failedAction: "REJECT",
                maxRetries: 3,
                retryTimeout: 3000,
                tooManyRequestsAction: "RETRY",
              }) &&
            target.apiKey === "hive-key" &&
            JSON.stringify(target.thresholds) ===
              JSON.stringify({ bullying: 2 })
          );
        })
        .reply(201, {
          id: mockRuleId,
          appId,
          ruleType: "hive/text-model-only",
          invocationMode: "BEFORE_PUBLISH",
          beforePublishConfig: {
            retryTimeout: 3000,
            maxRetries: 3,
            failedAction: "REJECT",
            tooManyRequestsAction: "RETRY",
          },
          source: { type: "chat.message" },
          target: {
            apiKey: "hive-key",
            modelUrl: null,
            thresholds: { bullying: 2 },
          },
          status: "enabled",
          created: 1640995200000,
          modified: 1640995200000,
        });

      const { stdout } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "hive/text-model-only",
          "--source-type",
          "chat.message",
          "--target-api-key",
          "hive-key",
          "--threshold",
          "bullying=2",
          "--json",
        ],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find((r) => r.type === "result")!;
      expect(result).toHaveProperty("success", true);
    });

    it("should create a hive/dashboard rule with AFTER_PUBLISH and no beforePublishConfig", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .post(`/v1/apps/${appId}/rules`, (body: Record<string, unknown>) => {
          return (
            body.invocationMode === "AFTER_PUBLISH" &&
            !("beforePublishConfig" in body) &&
            !("requestMode" in body)
          );
        })
        .reply(201, {
          id: mockRuleId,
          appId,
          ruleType: "hive/dashboard",
          invocationMode: "AFTER_PUBLISH",
          source: { type: "chat.message" },
          target: { apiKey: "dash-key" },
          status: "enabled",
          created: 1640995200000,
          modified: 1640995200000,
        });

      const { stdout } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "hive/dashboard",
          "--source-type",
          "chat.message",
          "--target-api-key",
          "dash-key",
          "--json",
        ],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find((r) => r.type === "result")!;
      expect(result).toHaveProperty("success", true);
    });

    it("should require --target-api-key for hive/dashboard", async () => {
      const { error } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "hive/dashboard",
          "--source-type",
          "chat.message",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(
        /target-api-key.*required.*hive\/dashboard/i,
      );
    });

    it("should create a bodyguard/text-moderation rule", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .post(`/v1/apps/${appId}/rules`, (body: Record<string, unknown>) => {
          const target = body.target as Record<string, unknown>;
          return target.apiKey === "bg-key" && target.channelId === "chan-1";
        })
        .reply(201, {
          id: mockRuleId,
          appId,
          ruleType: "bodyguard/text-moderation",
          invocationMode: "BEFORE_PUBLISH",
          beforePublishConfig: {
            retryTimeout: 3000,
            maxRetries: 3,
            failedAction: "REJECT",
            tooManyRequestsAction: "RETRY",
          },
          source: { type: "chat.message" },
          target: { apiKey: "bg-key", channelId: "chan-1" },
          status: "enabled",
          created: 1640995200000,
          modified: 1640995200000,
        });

      const { stdout } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "bodyguard/text-moderation",
          "--source-type",
          "chat.message",
          "--target-api-key",
          "bg-key",
          "--target-channel-id",
          "chan-1",
          "--json",
        ],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find((r) => r.type === "result")!;
      expect(result).toHaveProperty("success", true);
    });

    it("should require --target-api-key and --target-channel-id for bodyguard/text-moderation", async () => {
      const { error } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "bodyguard/text-moderation",
          "--source-type",
          "chat.message",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/target-api-key.*target-channel-id/i);
    });

    it("should create a tisane/text-moderation rule with thresholds and default language", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .post(`/v1/apps/${appId}/rules`, (body: Record<string, unknown>) => {
          const target = body.target as Record<string, unknown>;
          return (
            target.apiKey === "tisane-key" &&
            target.defaultLanguage === "*" &&
            JSON.stringify(target.thresholds) ===
              JSON.stringify({ allegation: 1, profanity: 1 })
          );
        })
        .reply(201, {
          id: mockRuleId,
          appId,
          ruleType: "tisane/text-moderation",
          invocationMode: "BEFORE_PUBLISH",
          beforePublishConfig: {
            retryTimeout: 3000,
            maxRetries: 3,
            failedAction: "REJECT",
            tooManyRequestsAction: "RETRY",
          },
          source: { type: "chat.message" },
          target: {
            apiKey: "tisane-key",
            modelUrl: null,
            thresholds: { allegation: 1, profanity: 1 },
            defaultLanguage: "*",
          },
          status: "enabled",
          created: 1640995200000,
          modified: 1640995200000,
        });

      const { stdout } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "tisane/text-moderation",
          "--source-type",
          "chat.message",
          "--target-api-key",
          "tisane-key",
          "--threshold",
          "allegation=1",
          "--threshold",
          "profanity=1",
          "--default-language",
          "*",
          "--json",
        ],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find((r) => r.type === "result")!;
      expect(result).toHaveProperty("success", true);
    });

    it("should create an azure/text-moderation rule", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .post(`/v1/apps/${appId}/rules`, (body: Record<string, unknown>) => {
          const target = body.target as Record<string, unknown>;
          return (
            target.apiKey === "azure-key" &&
            target.endpoint === "https://abc.cognitiveservices.azure.com" &&
            JSON.stringify(target.thresholds) === JSON.stringify({ Hate: 2 })
          );
        })
        .reply(201, {
          id: mockRuleId,
          appId,
          ruleType: "azure/text-moderation",
          invocationMode: "BEFORE_PUBLISH",
          beforePublishConfig: {
            retryTimeout: 3000,
            maxRetries: 3,
            failedAction: "REJECT",
            tooManyRequestsAction: "RETRY",
          },
          source: { type: "chat.message" },
          target: {
            apiKey: "azure-key",
            endpoint: "https://abc.cognitiveservices.azure.com",
            thresholds: { Hate: 2 },
          },
          status: "enabled",
          created: 1640995200000,
          modified: 1640995200000,
        });

      const { stdout } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "azure/text-moderation",
          "--source-type",
          "chat.message",
          "--target-api-key",
          "azure-key",
          "--target-endpoint",
          "https://abc.cognitiveservices.azure.com",
          "--threshold",
          "Hate=2",
          "--json",
        ],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find((r) => r.type === "result")!;
      expect(result).toHaveProperty("success", true);
    });

    it("should require --target-api-key and --target-endpoint for azure/text-moderation", async () => {
      const { error } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "azure/text-moderation",
          "--source-type",
          "chat.message",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/target-api-key.*target-endpoint/i);
    });

    it("should create an aws/lambda/before-publish rule with credentials authentication", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .post(`/v1/apps/${appId}/rules`, (body: Record<string, unknown>) => {
          const target = body.target as Record<string, unknown>;
          const authentication = target.authentication as Record<
            string,
            unknown
          >;
          return (
            target.functionName === "MyFunction" &&
            target.region === "eu-west-1" &&
            authentication.authenticationMode === "credentials" &&
            authentication.accessKeyId === "AKIA123" &&
            authentication.secretAccessKey === "secret123"
          );
        })
        .reply(201, {
          id: mockRuleId,
          appId,
          ruleType: "aws/lambda/before-publish",
          invocationMode: "BEFORE_PUBLISH",
          beforePublishConfig: {
            retryTimeout: 3000,
            maxRetries: 3,
            failedAction: "REJECT",
            tooManyRequestsAction: "RETRY",
          },
          source: { type: "chat.message" },
          target: {
            functionName: "MyFunction",
            region: "eu-west-1",
            authentication: {
              authenticationMode: "credentials",
              accessKeyId: "AKIA123",
            },
          },
          status: "enabled",
          created: 1640995200000,
          modified: 1640995200000,
        });

      const { stdout } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "aws/lambda/before-publish",
          "--source-type",
          "chat.message",
          "--target-function-name",
          "MyFunction",
          "--target-region",
          "eu-west-1",
          "--target-access-key-id",
          "AKIA123",
          "--target-secret-access-key",
          "secret123",
          "--json",
        ],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find((r) => r.type === "result")!;
      expect(result).toHaveProperty("success", true);
    });

    it("should require all target flags for aws/lambda/before-publish", async () => {
      const { error } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "aws/lambda/before-publish",
          "--source-type",
          "chat.message",
          "--target-function-name",
          "MyFunction",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(
        /target-region.*target-access-key-id.*target-secret-access-key/i,
      );
      expect(error?.message).not.toMatch(/target-function-name/i);
    });

    it("should override beforePublishConfig defaults with flags", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .post(`/v1/apps/${appId}/rules`, (body: Record<string, unknown>) => {
          return (
            JSON.stringify(body.beforePublishConfig) ===
            JSON.stringify({
              failedAction: "IGNORE",
              maxRetries: 5,
              retryTimeout: 5000,
              tooManyRequestsAction: "DROP",
            })
          );
        })
        .reply(201, {
          id: mockRuleId,
          appId,
          ruleType: "http/before-publish",
          invocationMode: "BEFORE_PUBLISH",
          beforePublishConfig: {
            retryTimeout: 5000,
            maxRetries: 5,
            failedAction: "IGNORE",
            tooManyRequestsAction: "DROP",
          },
          source: { type: "chat.message" },
          target: { url: "https://example.com/webhook" },
          status: "enabled",
          created: 1640995200000,
          modified: 1640995200000,
        });

      const { stdout } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "http/before-publish",
          "--source-type",
          "chat.message",
          "--target-url",
          "https://example.com/webhook",
          "--retry-timeout",
          "5000",
          "--max-retries",
          "5",
          "--failed-action",
          "IGNORE",
          "--too-many-requests-action",
          "DROP",
          "--json",
        ],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find((r) => r.type === "result")!;
      expect(result).toHaveProperty("success", true);
    });
  });

  standardHelpTests("integrations:create", import.meta.url);
  standardArgValidationTests("integrations:create", import.meta.url);
  standardFlagTests("integrations:create", import.meta.url, ["--json"]);
});
