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

describe("channel-rule:delete command (alias)", () => {
  const mockRuleId = "test-rule";

  afterEach(() => {
    controlApiCleanup();
  });

  describe("functionality", () => {
    it("should execute the same as apps:channel-rules:delete", async () => {
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
        .delete(`/v1/apps/${appId}/namespaces/${mockRuleId}`)
        .reply(200, {});

      const { stdout } = await runCommand(
        ["channel-rule:delete", mockRuleId, "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("deleted");
    });

    it("should require nameOrId argument", async () => {
      const { error } = await runCommand(
        ["channel-rule:delete", "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Missing 1 required arg/);
    });
  });

  standardHelpTests("channel-rule:delete", import.meta.url);
  standardArgValidationTests("channel-rule:delete", import.meta.url, {
    requiredArgs: ["nameOrId"],
  });
  standardFlagTests("channel-rule:delete", import.meta.url, ["--json"]);

  describe("error handling", () => {
    it("should require nameOrId argument", async () => {
      const { error } = await runCommand(
        ["channel-rule:delete", "--force"],
        import.meta.url,
      );
      expect(error).toBeDefined();
    });
  });
});
