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

describe("apps:channel-rules:update command", () => {
  const mockRuleId = "chat";

  afterEach(() => {
    controlApiCleanup();
  });

  describe("functionality", () => {
    it("should update a channel rule with persisted flag", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      // Mock listing namespaces to find the rule
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, [mockNamespace()]);

      // Mock update endpoint
      nockControl()
        .patch(`/v1/apps/${appId}/namespaces/${mockRuleId}`)
        .reply(200, mockNamespace({ persisted: true }));

      const { stdout } = await runCommand(
        ["apps:channel-rules:update", mockRuleId, "--persisted"],
        import.meta.url,
      );

      expect(stdout).toContain("Channel rule updated.");
      expect(stdout).toContain("Persisted: Yes");
    });

    it("should update a channel rule with push-enabled flag", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, [mockNamespace()]);

      nockControl()
        .patch(`/v1/apps/${appId}/namespaces/${mockRuleId}`)
        .reply(200, mockNamespace({ pushEnabled: true }));

      const { stdout } = await runCommand(
        ["apps:channel-rules:update", mockRuleId, "--push-enabled"],
        import.meta.url,
      );

      expect(stdout).toContain("Channel rule updated.");
      expect(stdout).toContain("Push Enabled: Yes");
    });

    it("should update a channel rule with mutable-messages flag and auto-enable persisted", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, [mockNamespace()]);

      nockControl()
        .patch(`/v1/apps/${appId}/namespaces/${mockRuleId}`, (body) => {
          return body.mutableMessages === true && body.persisted === true;
        })
        .reply(200, {
          ...mockNamespace({ persisted: true }),
          mutableMessages: true,
        });

      const { stdout, stderr } = await runCommand(
        ["apps:channel-rules:update", mockRuleId, "--mutable-messages"],
        import.meta.url,
      );

      expect(stdout).toContain("Channel rule updated.");
      expect(stdout).toContain("Persisted: Yes");
      expect(stdout).toContain("Mutable Messages: Yes");
      expect(stderr).toContain(
        "Message persistence is automatically enabled when mutable messages is enabled.",
      );
    });

    it("should error when --mutable-messages is used with --no-persisted", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, [mockNamespace({ persisted: true })]);

      const { error } = await runCommand(
        [
          "apps:channel-rules:update",
          mockRuleId,
          "--mutable-messages",
          "--no-persisted",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(
        /Cannot disable persistence when mutable messages is enabled/,
      );
    });

    it("should allow --no-mutable-messages --no-persisted to disable both", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, [
          { ...mockNamespace({ persisted: true }), mutableMessages: true },
        ]);

      nockControl()
        .patch(`/v1/apps/${appId}/namespaces/${mockRuleId}`, (body) => {
          return body.mutableMessages === false && body.persisted === false;
        })
        .reply(200, { ...mockNamespace(), mutableMessages: false });

      const { stdout } = await runCommand(
        [
          "apps:channel-rules:update",
          mockRuleId,
          "--no-mutable-messages",
          "--no-persisted",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Channel rule updated.");
      expect(stdout).toContain("Persisted: No");
    });

    it("should error when --no-persisted is used while existing rule has mutable messages", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, [
          { ...mockNamespace({ persisted: true }), mutableMessages: true },
        ]);

      const { error } = await runCommand(
        ["apps:channel-rules:update", mockRuleId, "--no-persisted"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(
        /Cannot disable persistence when mutable messages is enabled/,
      );
    });

    it("should include mutableMessages in JSON output when updating", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, [mockNamespace()]);

      nockControl()
        .patch(`/v1/apps/${appId}/namespaces/${mockRuleId}`)
        .reply(200, {
          ...mockNamespace({ persisted: true }),
          mutableMessages: true,
        });

      const { stdout } = await runCommand(
        [
          "apps:channel-rules:update",
          mockRuleId,
          "--mutable-messages",
          "--json",
        ],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result.rule).toHaveProperty("mutableMessages", true);
      expect(result.rule).toHaveProperty("persisted", true);
    });

    it("should output JSON format when --json flag is used", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, [mockNamespace()]);

      nockControl()
        .patch(`/v1/apps/${appId}/namespaces/${mockRuleId}`)
        .reply(200, mockNamespace({ persisted: true }));

      const { stdout } = await runCommand(
        ["apps:channel-rules:update", mockRuleId, "--persisted", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("rule");
      expect(result.rule).toHaveProperty("id", mockRuleId);
      expect(result.rule).toHaveProperty("persisted", true);
    });
  });

  standardHelpTests("apps:channel-rules:update", import.meta.url);
  standardArgValidationTests("apps:channel-rules:update", import.meta.url, {
    requiredArgs: ["test-rule"],
  });
  standardFlagTests("apps:channel-rules:update", import.meta.url, ["--json"]);

  describe("error handling", () => {
    standardControlApiErrorTests({
      commandArgs: ["apps:channel-rules:update", "chat", "--persisted"],
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

    it("should require nameOrId argument", async () => {
      const { error } = await runCommand(
        ["apps:channel-rules:update", "--persisted"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Missing 1 required arg/);
    });

    it("should require at least one update parameter", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, [mockNamespace()]);

      const { error } = await runCommand(
        ["apps:channel-rules:update", mockRuleId],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No update parameters provided/);
    });

    it("should handle channel rule not found", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl().get(`/v1/apps/${appId}/namespaces`).reply(200, []);

      const { error } = await runCommand(
        ["apps:channel-rules:update", "nonexistent", "--persisted"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/not found/);
    });
  });
});
