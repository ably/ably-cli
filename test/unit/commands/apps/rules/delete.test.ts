import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import {
  nockControl,
  controlApiCleanup,
} from "../../../../helpers/control-api-test-helpers.js";
import { getMockConfigManager } from "../../../../helpers/mock-config-manager.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
  standardControlApiErrorTests,
} from "../../../../helpers/standard-tests.js";
import { mockNamespace } from "../../../../fixtures/control-api.js";

describe("apps:rules:delete command", () => {
  const mockRuleId = "chat";

  afterEach(() => {
    controlApiCleanup();
  });

  standardHelpTests("apps:rules:delete", import.meta.url);
  standardArgValidationTests("apps:rules:delete", import.meta.url, {
    requiredArgs: [mockRuleId],
  });
  standardFlagTests("apps:rules:delete", import.meta.url, [
    "--json",
    "--app",
    "--force",
  ]);

  describe("functionality", () => {
    it("should delete a channel rule with force flag", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, [mockNamespace({ id: mockRuleId })]);

      nockControl()
        .delete(`/v1/apps/${appId}/namespaces/${mockRuleId}`)
        .reply(204);

      const { stdout } = await runCommand(
        ["apps:rules:delete", mockRuleId, "--force"],
        import.meta.url,
      );

      expect(stdout).toContain("deleted");
    });

    it("should output JSON format when --json flag is used", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, [mockNamespace({ id: mockRuleId })]);

      nockControl()
        .delete(`/v1/apps/${appId}/namespaces/${mockRuleId}`)
        .reply(204);

      const { stdout } = await runCommand(
        ["apps:rules:delete", mockRuleId, "--force", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("rule");
      expect(result.rule).toHaveProperty("id", mockRuleId);
    });
  });

  describe("error handling", () => {
    standardControlApiErrorTests({
      commandArgs: ["apps:rules:delete", mockRuleId, "--force"],
      importMetaUrl: import.meta.url,
      setupNock: (scenario) => {
        const appId = getMockConfigManager().getCurrentAppId()!;
        const scope = nockControl().get(`/v1/apps/${appId}/namespaces`);
        if (scenario === "401") scope.reply(401, { error: "Unauthorized" });
        else if (scenario === "500")
          scope.reply(500, { error: "Internal Server Error" });
        else scope.replyWithError("Network error");
      },
    });

    it("should handle channel rule not found", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl().get(`/v1/apps/${appId}/namespaces`).reply(200, []);

      const { error } = await runCommand(
        ["apps:rules:delete", "nonexistent", "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/not found/);
    });
  });
});
