import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";

describe("integrations:list command", () => {
  const mockIntegrations = [
    {
      id: "rule-001",
      appId: "app-123",
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
      version: "1.0",
      created: 1640995200000,
      modified: 1640995200000,
    },
    {
      id: "rule-002",
      appId: "app-123",
      ruleType: "amqp",
      requestMode: "batch",
      source: {
        channelFilter: "",
        type: "channel.presence",
      },
      target: {
        exchangeName: "ably",
        format: "json",
      },
      version: "1.0",
      created: 1640995200000,
      modified: 1640995200000,
    },
  ];

  afterEach(() => {
    nock.cleanAll();
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["integrations:list", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("List all integrations");
      expect(stdout).toContain("USAGE");
    });

    it("should display examples in help", async () => {
      const { stdout } = await runCommand(
        ["integrations:list", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("EXAMPLES");
    });
  });

  describe("argument validation", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["integrations:list", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("functionality", () => {
    it("should list integrations successfully", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/rules`)
        .reply(200, mockIntegrations);

      const { stdout } = await runCommand(
        ["integrations:list"],
        import.meta.url,
      );

      expect(stdout).toContain("rule-001");
      expect(stdout).toContain("rule-002");
      expect(stdout).toContain("http");
      expect(stdout).toContain("amqp");
    });

    it("should handle empty integrations list", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/rules`)
        .reply(200, []);

      const { stdout } = await runCommand(
        ["integrations:list"],
        import.meta.url,
      );

      expect(stdout).toContain("No integrations found");
    });

    it("should output JSON when --json flag is used", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/rules`)
        .reply(200, mockIntegrations);

      const { stdout } = await runCommand(
        ["integrations:list", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "integrations:list");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("integrations");
      expect(result.integrations).toBeInstanceOf(Array);
      expect(result.integrations).toHaveLength(2);
      expect(result).toHaveProperty("total", 2);
    });

    it("should display integration details in human-readable output", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/rules`)
        .reply(200, mockIntegrations);

      const { stdout } = await runCommand(
        ["integrations:list"],
        import.meta.url,
      );

      expect(stdout).toContain("Found 2 integrations");
      expect(stdout).toContain("Integration ID: rule-001");
      expect(stdout).toContain("Request Mode: single");
      expect(stdout).toContain("Source Type: channel.message");
      expect(stdout).toContain("Channel Filter: chat:*");
    });
  });

  describe("flags", () => {
    it("should accept --app flag", async () => {
      const { stdout } = await runCommand(
        ["integrations:list", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--app");
    });

    it("should accept --json flag", async () => {
      const { stdout } = await runCommand(
        ["integrations:list", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--json");
    });

    it("should accept --pretty-json flag", async () => {
      const { stdout } = await runCommand(
        ["integrations:list", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--pretty-json");
    });
  });

  describe("error handling", () => {
    it("should handle 401 authentication error", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/rules`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["integrations:list"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/401/);
    });

    it("should handle 500 server error", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/rules`)
        .reply(500, { error: "Internal Server Error" });

      const { error } = await runCommand(
        ["integrations:list"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/500/);
    });

    it("should handle network errors", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/rules`)
        .replyWithError("Network error");

      const { error } = await runCommand(
        ["integrations:list"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Network error/);
    });
  });
});
