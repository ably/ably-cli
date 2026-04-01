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
import { parseNdjsonLines } from "../../../../helpers/ndjson.js";

describe("apps:rules:update command", () => {
  const mockRuleId = "chat";

  afterEach(() => {
    controlApiCleanup();
  });

  standardHelpTests("apps:rules:update", import.meta.url);
  standardArgValidationTests("apps:rules:update", import.meta.url, {
    requiredArgs: [mockRuleId],
  });
  standardFlagTests("apps:rules:update", import.meta.url, [
    "--json",
    "--app",
    "--persisted",
    "--push-enabled",
    "--mutable-messages",
  ]);

  describe("functionality", () => {
    it("should update a rule with persisted flag", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, [mockNamespace({ id: mockRuleId })]);

      nockControl()
        .patch(`/v1/apps/${appId}/namespaces/${mockRuleId}`)
        .reply(200, mockNamespace({ id: mockRuleId, persisted: true }));

      const { stdout, stderr } = await runCommand(
        ["apps:rules:update", mockRuleId, "--persisted"],
        import.meta.url,
      );

      expect(stderr).toContain("updated");
      expect(stdout).toContain("Persisted:");
    });

    it("should update a rule with mutable-messages flag and auto-enable persistence", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, [mockNamespace({ id: mockRuleId })]);

      nockControl()
        .patch(`/v1/apps/${appId}/namespaces/${mockRuleId}`, (body) => {
          return body.mutableMessages === true && body.persisted === true;
        })
        .reply(200, mockNamespace({ id: mockRuleId, persisted: true }));

      const { stderr } = await runCommand(
        ["apps:rules:update", mockRuleId, "--mutable-messages"],
        import.meta.url,
      );

      expect(stderr).toContain("updated");
      expect(stderr).toContain("persistence is automatically enabled");
    });

    it("should fail when disabling persistence with mutable messages enabled", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, [
          {
            ...mockNamespace({ id: mockRuleId, persisted: true }),
            mutableMessages: true,
          },
        ]);

      const { error } = await runCommand(
        ["apps:rules:update", mockRuleId, "--no-persisted"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Cannot disable persistence/);
    });

    it("should error when --mutable-messages is used with --no-persisted", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, [mockNamespace({ id: mockRuleId, persisted: true })]);

      const { error } = await runCommand(
        [
          "apps:rules:update",
          mockRuleId,
          "--mutable-messages",
          "--no-persisted",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(
        /Cannot disable persistence when mutable messages is enabled/,
      );
    });

    it("should allow --no-mutable-messages --no-persisted to disable both", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, [mockNamespace({ id: mockRuleId, persisted: true })]);

      nockControl()
        .patch(`/v1/apps/${appId}/namespaces/${mockRuleId}`, (body) => {
          return body.mutableMessages === false && body.persisted === false;
        })
        .reply(200, mockNamespace({ id: mockRuleId }));

      const { stdout, stderr } = await runCommand(
        [
          "apps:rules:update",
          mockRuleId,
          "--no-mutable-messages",
          "--no-persisted",
        ],
        import.meta.url,
      );

      expect(stderr).toContain("updated");
      expect(stdout).toContain("Persisted: No");
    });

    it("should update a rule with push-enabled flag", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, [mockNamespace({ id: mockRuleId })]);

      nockControl()
        .patch(`/v1/apps/${appId}/namespaces/${mockRuleId}`)
        .reply(200, mockNamespace({ id: mockRuleId, pushEnabled: true }));

      const { stdout, stderr } = await runCommand(
        ["apps:rules:update", mockRuleId, "--push-enabled"],
        import.meta.url,
      );

      expect(stderr).toContain("updated");
      expect(stdout).toContain("Push Enabled:");
    });

    it("should output JSON format when --json flag is used", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, [mockNamespace({ id: mockRuleId })]);

      nockControl()
        .patch(`/v1/apps/${appId}/namespaces/${mockRuleId}`)
        .reply(200, mockNamespace({ id: mockRuleId, persisted: true }));

      const { stdout } = await runCommand(
        ["apps:rules:update", mockRuleId, "--persisted", "--json"],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find((r) => r.type === "result")!;
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("rule");
      const rule = result.rule as Record<string, unknown>;
      expect(rule).toHaveProperty("id", mockRuleId);
      expect(rule).toHaveProperty("persisted", true);
    });

    it("should include mutableMessages in JSON output when updating", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, [mockNamespace({ id: mockRuleId })]);

      nockControl()
        .patch(`/v1/apps/${appId}/namespaces/${mockRuleId}`)
        .reply(200, mockNamespace({ id: mockRuleId, persisted: true }));

      const { stdout } = await runCommand(
        ["apps:rules:update", mockRuleId, "--mutable-messages", "--json"],
        import.meta.url,
      );

      const records = stdout
        .trim()
        .split("\n")
        .map((line: string) => JSON.parse(line));
      const result = records.find(
        (r: Record<string, unknown>) => r.type === "result",
      );
      expect(result).toHaveProperty("success", true);
      expect(result!.rule).toHaveProperty("persisted", true);
    });
  });

  describe("error handling", () => {
    standardControlApiErrorTests({
      commandArgs: ["apps:rules:update", mockRuleId, "--persisted"],
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

    it("should handle rule not found", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl().get(`/v1/apps/${appId}/namespaces`).reply(200, []);

      const { error } = await runCommand(
        ["apps:rules:update", "nonexistent", "--persisted"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/not found/);
    });

    it("should require at least one update parameter", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, [mockNamespace({ id: mockRuleId })]);

      const { error } = await runCommand(
        ["apps:rules:update", mockRuleId],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/No update parameters provided/);
    });
  });
});
