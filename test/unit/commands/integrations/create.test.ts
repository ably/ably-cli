import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

describe("integrations:create command", () => {
  const mockAccessToken = "fake_access_token";
  const mockAccountId = "test-account-id";
  const mockAppId = "550e8400-e29b-41d4-a716-446655440000";
  const mockRuleId = "rule-123456";
  let testConfigDir: string;
  let originalConfigDir: string;

  beforeEach(() => {
    process.env.ABLY_ACCESS_TOKEN = mockAccessToken;

    testConfigDir = resolve(tmpdir(), `ably-cli-test-${Date.now()}`);
    mkdirSync(testConfigDir, { recursive: true, mode: 0o700 });

    originalConfigDir = process.env.ABLY_CLI_CONFIG_DIR || "";
    process.env.ABLY_CLI_CONFIG_DIR = testConfigDir;

    const configContent = `[current]
account = "default"

[accounts.default]
accessToken = "${mockAccessToken}"
accountId = "${mockAccountId}"
accountName = "Test Account"
userEmail = "test@example.com"
currentAppId = "${mockAppId}"
`;
    writeFileSync(resolve(testConfigDir, "config"), configContent);
  });

  afterEach(() => {
    nock.cleanAll();
    delete process.env.ABLY_ACCESS_TOKEN;

    if (originalConfigDir) {
      process.env.ABLY_CLI_CONFIG_DIR = originalConfigDir;
    } else {
      delete process.env.ABLY_CLI_CONFIG_DIR;
    }

    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe("successful integration creation", () => {
    it("should create an HTTP integration successfully", async () => {
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
        created: Date.now(),
        modified: Date.now(),
      };

      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/rules`)
        .reply(201, mockIntegration);

      const { stdout } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "http",
          "--source-type",
          "channel.message",
          "--target-url",
          "https://example.com/webhook",
          "--channel-filter",
          "chat:*",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Integration created successfully");
      expect(stdout).toContain(mockRuleId);
      expect(stdout).toContain("http");
    });

    it("should create an AMQP integration successfully", async () => {
      const mockIntegration = {
        id: mockRuleId,
        appId: mockAppId,
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
        created: Date.now(),
        modified: Date.now(),
      };

      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/rules`)
        .reply(201, mockIntegration);

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

    it("should output JSON format when --json flag is used", async () => {
      const mockIntegration = {
        id: mockRuleId,
        appId: mockAppId,
        ruleType: "http",
        requestMode: "single",
        source: {
          channelFilter: "",
          type: "channel.message",
        },
        target: {
          url: "https://example.com/webhook",
          format: "json",
          enveloped: true,
        },
        status: "enabled",
      };

      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/rules`)
        .reply(201, mockIntegration);

      const { stdout } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "http",
          "--source-type",
          "channel.message",
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

    it("should create a disabled integration when status is disabled", async () => {
      const mockIntegration = {
        id: mockRuleId,
        appId: mockAppId,
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
      };

      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/rules`, (body: any) => {
          return body.status === "disabled";
        })
        .reply(201, mockIntegration);

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
      const mockIntegration = {
        id: mockRuleId,
        appId: mockAppId,
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
      };

      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/rules`, (body: any) => {
          return body.requestMode === "batch";
        })
        .reply(201, mockIntegration);

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
  });

  describe("error handling", () => {
    it("should require rule-type flag", async () => {
      const { error } = await runCommand(
        ["integrations:create", "--source-type", "channel.message"],
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
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/rules`)
        .reply(400, { error: "Invalid integration configuration" });

      const { error } = await runCommand(
        [
          "integrations:create",
          "--rule-type",
          "http",
          "--source-type",
          "channel.message",
          "--target-url",
          "https://example.com/webhook",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Error creating integration|400/i);
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
      const mockIntegration = {
        id: mockRuleId,
        appId: mockAppId,
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
      };

      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/rules`)
        .reply(201, mockIntegration);

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
      const mockIntegration = {
        id: mockRuleId,
        appId: mockAppId,
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
      };

      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/rules`)
        .reply(201, mockIntegration);

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
