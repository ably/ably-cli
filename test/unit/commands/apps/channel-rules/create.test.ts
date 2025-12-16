import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { getMockConfigManager } from "../../../../helpers/mock-config-manager.js";

describe("apps:channel-rules:create command", () => {
  const mockRuleName = "chat";
  const mockRuleId = "chat";

  afterEach(() => {
    nock.cleanAll();
  });

  describe("successful channel rule creation", () => {
    it("should create a channel rule successfully", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/namespaces`)
        .reply(201, {
          id: mockRuleId,
          persisted: false,
          pushEnabled: false,
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout } = await runCommand(
        ["apps:channel-rules:create", "--name", mockRuleName, "--app", appId],
        import.meta.url,
      );

      expect(stdout).toContain("Channel rule created successfully");
      expect(stdout).toContain(mockRuleId);
    });

    it("should create a channel rule with persisted flag", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/namespaces`, (body) => {
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
          appId,
          "--persisted",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Channel rule created successfully");
      expect(stdout).toContain("Persisted: Yes");
    });

    it("should create a channel rule with push-enabled flag", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/namespaces`, (body) => {
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
          appId,
          "--push-enabled",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Channel rule created successfully");
      expect(stdout).toContain("Push Enabled: Yes");
    });

    it("should output JSON format when --json flag is used", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockRule = {
        id: mockRuleId,
        persisted: false,
        pushEnabled: false,
        created: Date.now(),
        modified: Date.now(),
      };

      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/namespaces`)
        .reply(201, mockRule);

      const { stdout } = await runCommand(
        [
          "apps:channel-rules:create",
          "--name",
          mockRuleName,
          "--app",
          appId,
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
      const appId = getMockConfigManager().getCurrentAppId()!;
      const { error } = await runCommand(
        ["apps:channel-rules:create", "--app", appId],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing required flag.*name/);
    });

    it("should handle 401 authentication error", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/namespaces`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["apps:channel-rules:create", "--name", mockRuleName, "--app", appId],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/401/);
    });

    it("should handle 400 validation error", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/namespaces`)
        .reply(400, { error: "Validation failed" });

      const { error } = await runCommand(
        ["apps:channel-rules:create", "--name", mockRuleName, "--app", appId],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/400/);
    });

    it("should handle network errors", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/namespaces`)
        .replyWithError("Network error");

      const { error } = await runCommand(
        ["apps:channel-rules:create", "--name", mockRuleName, "--app", appId],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Network error/);
    });
  });
});
