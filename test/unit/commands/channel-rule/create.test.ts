import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";

describe("channel-rule:create command (alias)", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  describe("alias behavior", () => {
    it("should execute the same as apps:channel-rules:create", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/namespaces`)
        .reply(200, {
          id: "test-rule",
          persisted: true,
          pushEnabled: false,
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout } = await runCommand(
        [
          "channel-rule:create",
          "--name=test-rule",
          "--app",
          appId,
          "--persisted",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Channel rule created successfully");
    });

    it("should require name flag", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const { error } = await runCommand(
        ["channel-rule:create", "--app", appId],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing required flag.*name/);
    });
  });
});
