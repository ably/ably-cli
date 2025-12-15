import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { DEFAULT_TEST_CONFIG } from "../../../helpers/mock-config-manager.js";

describe("channel-rule:update command (alias)", () => {
  const mockAppId = DEFAULT_TEST_CONFIG.appId;
  const mockRuleId = "test-rule";

  afterEach(() => {
    nock.cleanAll();
  });

  describe("alias behavior", () => {
    it("should execute the same as apps:channel-rules:update", async () => {
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
        ["channel-rule:update", mockRuleId, "--app", mockAppId, "--persisted"],
        import.meta.url,
      );

      expect(stdout).toContain("Channel rule updated successfully");
    });

    it("should require nameOrId argument", async () => {
      const { error } = await runCommand(
        ["channel-rule:update", "--app", mockAppId, "--persisted"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing 1 required arg/);
    });
  });
});
