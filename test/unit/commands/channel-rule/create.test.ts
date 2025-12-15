import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { DEFAULT_TEST_CONFIG } from "../../../helpers/mock-config-manager.js";

describe("channel-rule:create command (alias)", () => {
  const mockAppId = DEFAULT_TEST_CONFIG.appId;

  afterEach(() => {
    nock.cleanAll();
  });

  describe("alias behavior", () => {
    it("should execute the same as apps:channel-rules:create", async () => {
      nock("https://control.ably.net")
        .post(`/v1/apps/${mockAppId}/namespaces`)
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
          mockAppId,
          "--persisted",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Channel rule created successfully");
    });

    it("should require name flag", async () => {
      const { error } = await runCommand(
        ["channel-rule:create", "--app", mockAppId],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing required flag.*name/);
    });
  });
});
