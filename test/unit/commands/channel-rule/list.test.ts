import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import {
  nockControl,
  controlApiCleanup,
} from "../../../helpers/control-api-test-helpers.js";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

describe("channel-rule:list command (alias)", () => {
  afterEach(() => {
    controlApiCleanup();
  });

  describe("functionality", () => {
    it("should execute the same as apps:channel-rules:list", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
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
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl().get(`/v1/apps/${appId}/namespaces`).reply(200, []);

      const { stdout } = await runCommand(
        ["channel-rule:list"],
        import.meta.url,
      );

      expect(stdout).toContain("No channel rules found");
    });
  });

  standardHelpTests("channel-rule:list", import.meta.url);
  standardArgValidationTests("channel-rule:list", import.meta.url);
  standardFlagTests("channel-rule:list", import.meta.url, ["--json"]);

  describe("error handling", () => {
    it("should handle API errors gracefully", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["channel-rule:list"],
        import.meta.url,
      );
      expect(error).toBeDefined();
    });
  });
});
