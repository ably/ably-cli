import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { DEFAULT_TEST_CONFIG } from "../../../../helpers/mock-config-manager.js";

describe("apps:channel-rules:update command", () => {
  const mockAppId = DEFAULT_TEST_CONFIG.appId;
  const mockRuleId = "chat";

  afterEach(() => {
    nock.cleanAll();
  });

  describe("successful channel rule update", () => {
    it("should update a channel rule with persisted flag", async () => {
      // Mock listing namespaces to find the rule
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/namespaces`)
        .reply(200, [
          {
            id: mockRuleId,
            persisted: false,
            pushEnabled: false,
            created: Date.now(),
            modified: Date.now(),
          },
        ]);

      // Mock update endpoint
      nock("https://control.ably.net")
        .patch(`/v1/apps/${mockAppId}/namespaces/${mockRuleId}`)
        .reply(200, {
          id: mockRuleId,
          persisted: true,
          pushEnabled: false,
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout } = await runCommand(
        [
          "apps:channel-rules:update",
          mockRuleId,
          "--app",
          mockAppId,
          "--persisted",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Channel rule updated successfully");
      expect(stdout).toContain("Persisted: Yes");
    });

    it("should update a channel rule with push-enabled flag", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/namespaces`)
        .reply(200, [
          {
            id: mockRuleId,
            persisted: false,
            pushEnabled: false,
            created: Date.now(),
            modified: Date.now(),
          },
        ]);

      nock("https://control.ably.net")
        .patch(`/v1/apps/${mockAppId}/namespaces/${mockRuleId}`)
        .reply(200, {
          id: mockRuleId,
          persisted: false,
          pushEnabled: true,
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout } = await runCommand(
        [
          "apps:channel-rules:update",
          mockRuleId,
          "--app",
          mockAppId,
          "--push-enabled",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Channel rule updated successfully");
      expect(stdout).toContain("Push Enabled: Yes");
    });

    it("should output JSON format when --json flag is used", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/namespaces`)
        .reply(200, [
          {
            id: mockRuleId,
            persisted: false,
            pushEnabled: false,
            created: Date.now(),
            modified: Date.now(),
          },
        ]);

      nock("https://control.ably.net")
        .patch(`/v1/apps/${mockAppId}/namespaces/${mockRuleId}`)
        .reply(200, {
          id: mockRuleId,
          persisted: true,
          pushEnabled: false,
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout } = await runCommand(
        [
          "apps:channel-rules:update",
          mockRuleId,
          "--app",
          mockAppId,
          "--persisted",
          "--json",
        ],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("rule");
      expect(result.rule).toHaveProperty("id", mockRuleId);
      expect(result.rule).toHaveProperty("persisted", true);
    });
  });

  describe("error handling", () => {
    it("should require nameOrId argument", async () => {
      const { error } = await runCommand(
        ["apps:channel-rules:update", "--app", mockAppId, "--persisted"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing 1 required arg/);
    });

    it("should require at least one update parameter", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/namespaces`)
        .reply(200, [
          {
            id: mockRuleId,
            persisted: false,
            pushEnabled: false,
            created: Date.now(),
            modified: Date.now(),
          },
        ]);

      const { error } = await runCommand(
        ["apps:channel-rules:update", mockRuleId, "--app", mockAppId],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/No update parameters provided/);
    });

    it("should handle channel rule not found", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/namespaces`)
        .reply(200, []);

      const { error } = await runCommand(
        [
          "apps:channel-rules:update",
          "nonexistent",
          "--app",
          mockAppId,
          "--persisted",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/not found/);
    });

    it("should handle 401 authentication error", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/namespaces`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        [
          "apps:channel-rules:update",
          mockRuleId,
          "--app",
          mockAppId,
          "--persisted",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/401/);
    });

    it("should handle network errors", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/namespaces`)
        .replyWithError("Network error");

      const { error } = await runCommand(
        [
          "apps:channel-rules:update",
          mockRuleId,
          "--app",
          mockAppId,
          "--persisted",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Network error/);
    });
  });
});
