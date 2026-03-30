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

describe("apps:rules:list command", () => {
  afterEach(() => {
    controlApiCleanup();
  });

  standardHelpTests("apps:rules:list", import.meta.url);
  standardArgValidationTests("apps:rules:list", import.meta.url);
  standardFlagTests("apps:rules:list", import.meta.url, ["--json", "--app"]);

  describe("functionality", () => {
    it("should list rules successfully", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, [
          mockNamespace({ id: "chat", persisted: true }),
          mockNamespace({ id: "events", pushEnabled: true }),
        ]);

      const { stdout } = await runCommand(["apps:rules:list"], import.meta.url);

      expect(stdout).toContain("Found 2 rules");
      expect(stdout).toContain("chat");
      expect(stdout).toContain("events");
    });

    it("should handle empty rules list", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl().get(`/v1/apps/${appId}/namespaces`).reply(200, []);

      const { stdout } = await runCommand(["apps:rules:list"], import.meta.url);

      expect(stdout).toContain("No rules found");
    });

    it("should display rule details correctly", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, [
          mockNamespace({
            id: "chat",
            persisted: true,
            pushEnabled: true,
          }),
        ]);

      const { stdout } = await runCommand(["apps:rules:list"], import.meta.url);

      expect(stdout).toContain("Found 1 rule");
      expect(stdout).toContain("chat");
      expect(stdout).toContain("Persisted: ✓ Yes");
      expect(stdout).toContain("Push Enabled: ✓ Yes");
    });

    it("should display mutableMessages in rule details", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, [
          mockNamespace({
            id: "mutable-chat",
            persisted: true,
            mutableMessages: true,
          }),
        ]);

      const { stdout } = await runCommand(["apps:rules:list"], import.meta.url);

      expect(stdout).toContain("mutable-chat");
      expect(stdout).toContain("Mutable Messages:");
    });

    it("should output JSON format when --json flag is used", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, [mockNamespace({ id: "chat", persisted: true })]);

      const { stdout } = await runCommand(
        ["apps:rules:list", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("rules");
      expect(result.rules).toHaveLength(1);
    });

    it("should include mutableMessages in JSON output", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, [
          mockNamespace({ id: "mutable-chat", persisted: true }),
          mockNamespace({ id: "regular-chat" }),
        ]);

      const { stdout } = await runCommand(
        ["apps:rules:list", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result.rules).toHaveLength(2);
    });
  });

  describe("error handling", () => {
    standardControlApiErrorTests({
      commandArgs: ["apps:rules:list"],
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

    it("should handle 404 not found error", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(404, { error: "App not found" });

      const { error } = await runCommand(["apps:rules:list"], import.meta.url);

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/404/);
    });
  });
});
