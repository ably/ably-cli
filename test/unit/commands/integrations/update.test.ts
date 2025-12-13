import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

describe("integrations:update command", () => {
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

  describe("successful integration update", () => {
    it("should update channel filter", async () => {
      const updatedIntegration = {
        ...mockIntegration,
        source: {
          ...mockIntegration.source,
          channelFilter: "messages:*",
        },
      };

      // Mock GET to fetch existing integration
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      // Mock PATCH to update integration
      nock("https://control.ably.net")
        .patch(`/v1/apps/${mockAppId}/rules/${mockRuleId}`)
        .reply(200, updatedIntegration);

      const { stdout } = await runCommand(
        ["integrations:update", mockRuleId, "--channel-filter", "messages:*"],
        import.meta.url,
      );

      expect(stdout).toContain("Integration Rule Updated Successfully");
      expect(stdout).toContain(mockRuleId);
    });

    it("should update target URL for HTTP integrations", async () => {
      const newUrl = "https://new-example.com/webhook";
      const updatedIntegration = {
        ...mockIntegration,
        target: {
          ...mockIntegration.target,
          url: newUrl,
        },
      };

      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      nock("https://control.ably.net")
        .patch(`/v1/apps/${mockAppId}/rules/${mockRuleId}`)
        .reply(200, updatedIntegration);

      const { stdout } = await runCommand(
        ["integrations:update", mockRuleId, "--target-url", newUrl],
        import.meta.url,
      );

      expect(stdout).toContain("Integration Rule Updated Successfully");
    });

    it("should output JSON format when --json flag is used", async () => {
      const updatedIntegration = {
        ...mockIntegration,
        source: {
          ...mockIntegration.source,
          channelFilter: "updates:*",
        },
      };

      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      nock("https://control.ably.net")
        .patch(`/v1/apps/${mockAppId}/rules/${mockRuleId}`)
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
      expect(result).toHaveProperty("rule");
      expect(result.rule).toHaveProperty("id", mockRuleId);
    });

    it("should update request mode", async () => {
      const updatedIntegration = {
        ...mockIntegration,
        requestMode: "batch",
      };

      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      nock("https://control.ably.net")
        .patch(`/v1/apps/${mockAppId}/rules/${mockRuleId}`)
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
      expect(result.rule).toHaveProperty("requestMode", "batch");
    });
  });

  describe("error handling", () => {
    it("should require ruleId argument", async () => {
      const { error } = await runCommand(
        ["integrations:update", "--channel-filter", "test:*"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Missing.*required arg/i);
    });

    it("should handle integration not found", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/rules/${mockRuleId}`)
        .reply(404, { error: "Not found" });

      const { error } = await runCommand(
        ["integrations:update", mockRuleId, "--channel-filter", "test:*"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Error updating integration|404/i);
    });

    it("should handle API errors during update", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/rules/${mockRuleId}`)
        .reply(200, mockIntegration);

      nock("https://control.ably.net")
        .patch(`/v1/apps/${mockAppId}/rules/${mockRuleId}`)
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
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("flag options", () => {
    it("should accept --app flag", async () => {
      const updatedIntegration = {
        ...mockIntegration,
        source: {
          ...mockIntegration.source,
          channelFilter: "new:*",
        },
      };

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

      nock("https://control.ably.net")
        .patch(`/v1/apps/${mockAppId}/rules/${mockRuleId}`)
        .reply(200, updatedIntegration);

      const { stdout } = await runCommand(
        [
          "integrations:update",
          mockRuleId,
          "--app",
          mockAppId,
          "--channel-filter",
          "new:*",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Integration Rule Updated Successfully");
    });
  });
});
