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

describe("channel-rule:create command (alias)", () => {
  afterEach(() => {
    controlApiCleanup();
  });

  describe("functionality", () => {
    it("should execute the same as apps:channel-rules:create", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl().post(`/v1/apps/${appId}/namespaces`).reply(200, {
        id: "test-rule",
        persisted: true,
        pushEnabled: false,
        created: Date.now(),
        modified: Date.now(),
      });

      const { stdout } = await runCommand(
        ["channel-rule:create", "--name=test-rule", "--persisted"],
        import.meta.url,
      );

      expect(stdout).toContain("Channel rule created.");
    });

    it("should require name flag", async () => {
      const { error } = await runCommand(
        ["channel-rule:create"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Missing required flag.*name/);
    });
  });

  standardHelpTests("channel-rule:create", import.meta.url);
  standardArgValidationTests("channel-rule:create", import.meta.url);
  standardFlagTests("channel-rule:create", import.meta.url, ["--json"]);

  describe("error handling", () => {
    it("should require name flag", async () => {
      const { error } = await runCommand(
        ["channel-rule:create"],
        import.meta.url,
      );
      expect(error).toBeDefined();
    });
  });
});
