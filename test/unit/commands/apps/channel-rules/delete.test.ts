import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { DEFAULT_TEST_CONFIG } from "../../../../helpers/mock-config-manager.js";

describe("apps:channel-rules:delete command", () => {
  const mockAppId = DEFAULT_TEST_CONFIG.appId;
  const mockRuleId = "chat";

  afterEach(() => {
    nock.cleanAll();
  });

  describe("successful channel rule deletion", () => {
    it("should delete a channel rule with force flag", async () => {
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

      // Mock delete endpoint
      nock("https://control.ably.net")
        .delete(`/v1/apps/${mockAppId}/namespaces/${mockRuleId}`)
        .reply(204);

      const { stdout } = await runCommand(
        [
          "apps:channel-rules:delete",
          mockRuleId,
          "--app",
          mockAppId,
          "--force",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("deleted successfully");
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
        .delete(`/v1/apps/${mockAppId}/namespaces/${mockRuleId}`)
        .reply(204);

      const { stdout } = await runCommand(
        [
          "apps:channel-rules:delete",
          mockRuleId,
          "--app",
          mockAppId,
          "--force",
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
    it("should require nameOrId argument", async () => {
      const { error } = await runCommand(
        ["apps:channel-rules:delete", "--app", mockAppId],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing 1 required arg/);
    });

    it("should handle channel rule not found", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/namespaces`)
        .reply(200, []);

      const { error } = await runCommand(
        [
          "apps:channel-rules:delete",
          "nonexistent",
          "--app",
          mockAppId,
          "--force",
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
          "apps:channel-rules:delete",
          mockRuleId,
          "--app",
          mockAppId,
          "--force",
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
          "apps:channel-rules:delete",
          mockRuleId,
          "--app",
          mockAppId,
          "--force",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Network error/);
    });
  });
});
