import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";

describe("channel-rule:delete command (alias)", () => {
  const mockRuleId = "test-rule";

  afterEach(() => {
    nock.cleanAll();
  });

  describe("alias behavior", () => {
    it("should execute the same as apps:channel-rules:delete", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/namespaces`)
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
        .delete(`/v1/apps/${appId}/namespaces/${mockRuleId}`)
        .reply(200, {});

      const { stdout } = await runCommand(
        ["channel-rule:delete", mockRuleId, "--app", appId, "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("deleted successfully");
    });

    it("should require nameOrId argument", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const { error } = await runCommand(
        ["channel-rule:delete", "--app", appId, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing 1 required arg/);
    });
  });
});
