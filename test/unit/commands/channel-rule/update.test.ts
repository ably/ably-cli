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

describe("channel-rule:update command (alias)", () => {
  const mockRuleId = "test-rule";

  afterEach(() => {
    controlApiCleanup();
  });

  describe("functionality", () => {
    it("should execute the same as apps:channel-rules:update", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
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

      nockControl()
        .patch(`/v1/apps/${appId}/namespaces/${mockRuleId}`)
        .reply(200, {
          id: mockRuleId,
          persisted: true,
          pushEnabled: false,
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout } = await runCommand(
        ["channel-rule:update", mockRuleId, "--persisted"],
        import.meta.url,
      );

      expect(stdout).toContain("Channel rule updated.");
    });

    it("should require nameOrId argument", async () => {
      const { error } = await runCommand(
        ["channel-rule:update", "--persisted"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Missing 1 required arg/);
    });
  });

  standardHelpTests("channel-rule:update", import.meta.url);
  standardArgValidationTests("channel-rule:update", import.meta.url, {
    requiredArgs: ["nameOrId"],
  });
  standardFlagTests("channel-rule:update", import.meta.url, ["--json"]);

  describe("error handling", () => {
    it("should require nameOrId argument", async () => {
      const { error } = await runCommand(
        ["channel-rule:update", "--persisted"],
        import.meta.url,
      );
      expect(error).toBeDefined();
    });
  });
});
