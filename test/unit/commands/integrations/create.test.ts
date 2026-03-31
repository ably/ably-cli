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
            channelFilter: "chat:*",
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
          "chat:*",
          "--target-url",
          "https://example.com/webhook",
        ],
        import.meta.url,
      );

      expect(stderr).toContain("Integration rule created:");
      expect(stdout).toContain(mockRuleId);
      expect(stdout).toContain("http");
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
            channelFilter: "chat:*",
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
          "chat:*",
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
        "chat:*",
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
          "chat:*",
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
  });

  standardHelpTests("integrations:create", import.meta.url);
  standardArgValidationTests("integrations:create", import.meta.url);
  standardFlagTests("integrations:create", import.meta.url, ["--json"]);
});
