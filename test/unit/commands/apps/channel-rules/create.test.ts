import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

describe("apps:channel-rules:create command", () => {
  const mockAccessToken = "fake_access_token";
  const mockAccountId = "test-account-id";
  const mockAppId = "550e8400-e29b-41d4-a716-446655440000";
  const mockRuleName = "chat";
  const mockRuleId = "chat";
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

  describe("successful channel rule creation", () => {
    it("should create a channel rule successfully", async () => {
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/namespaces`)
        .reply(201, {
          id: mockRuleId,
          persisted: false,
          pushEnabled: false,
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout } = await runCommand(
        [
          "apps:channel-rules:create",
          "--name",
          mockRuleName,
          "--app",
          mockAppId,
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Channel rule created successfully");
      expect(stdout).toContain(mockRuleId);
    });

    it("should create a channel rule with persisted flag", async () => {
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/namespaces`, (body) => {
          return body.persisted === true;
        })
        .reply(201, {
          id: mockRuleId,
          persisted: true,
          pushEnabled: false,
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout } = await runCommand(
        [
          "apps:channel-rules:create",
          "--name",
          mockRuleName,
          "--app",
          mockAppId,
          "--persisted",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Channel rule created successfully");
      expect(stdout).toContain("Persisted: Yes");
    });

    it("should create a channel rule with push-enabled flag", async () => {
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/namespaces`, (body) => {
          return body.pushEnabled === true;
        })
        .reply(201, {
          id: mockRuleId,
          persisted: false,
          pushEnabled: true,
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout } = await runCommand(
        [
          "apps:channel-rules:create",
          "--name",
          mockRuleName,
          "--app",
          mockAppId,
          "--push-enabled",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Channel rule created successfully");
      expect(stdout).toContain("Push Enabled: Yes");
    });

    it("should output JSON format when --json flag is used", async () => {
      const mockRule = {
        id: mockRuleId,
        persisted: false,
        pushEnabled: false,
        created: Date.now(),
        modified: Date.now(),
      };

      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/namespaces`)
        .reply(201, mockRule);

      const { stdout } = await runCommand(
        [
          "apps:channel-rules:create",
          "--name",
          mockRuleName,
          "--app",
          mockAppId,
          "--json",
        ],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("rule");
      expect(result.rule).toHaveProperty("id", mockRuleId);
    });
  });

  describe("error handling", () => {
    it("should require name parameter", async () => {
      const { error } = await runCommand(
        ["apps:channel-rules:create", "--app", mockAppId],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing required flag.*name/);
    });

    it("should handle 401 authentication error", async () => {
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/namespaces`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        [
          "apps:channel-rules:create",
          "--name",
          mockRuleName,
          "--app",
          mockAppId,
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/401/);
    });

    it("should handle 400 validation error", async () => {
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/namespaces`)
        .reply(400, { error: "Validation failed" });

      const { error } = await runCommand(
        [
          "apps:channel-rules:create",
          "--name",
          mockRuleName,
          "--app",
          mockAppId,
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/400/);
    });

    it("should handle network errors", async () => {
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/namespaces`)
        .replyWithError("Network error");

      const { error } = await runCommand(
        [
          "apps:channel-rules:create",
          "--name",
          mockRuleName,
          "--app",
          mockAppId,
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Network error/);
    });
  });
});
