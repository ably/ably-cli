import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { DEFAULT_TEST_CONFIG } from "../../../helpers/mock-config-manager.js";

describe("channel-rule:list command (alias)", () => {
  const mockAppId = DEFAULT_TEST_CONFIG.appId;

  afterEach(() => {
    nock.cleanAll();
  });

  describe("alias behavior", () => {
    it("should execute the same as apps:channel-rules:list", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/namespaces`)
        .reply(200, [
          {
            id: "rule1",
            persisted: true,
            pushEnabled: false,
            created: Date.now(),
            modified: Date.now(),
          },
          {
            id: "rule2",
            persisted: false,
            pushEnabled: true,
            created: Date.now(),
            modified: Date.now(),
          },
        ]);

      const { stdout } = await runCommand(
        ["channel-rule:list"],
        import.meta.url,
      );

      expect(stdout).toContain("rule1");
      expect(stdout).toContain("rule2");
    });

    it("should show message when no rules found", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/namespaces`)
        .reply(200, []);

      const { stdout } = await runCommand(
        ["channel-rule:list"],
        import.meta.url,
      );

      expect(stdout).toContain("No channel rules found");
    });
  });
});
