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

describe("apps:channel-rules:list command", () => {
  afterEach(() => {
    controlApiCleanup();
  });

  describe("functionality", () => {
    it("should list channel rules successfully", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockRules = [
        mockNamespace({ persisted: true }),
        mockNamespace({ id: "events", pushEnabled: true }),
      ];

      nockControl().get(`/v1/apps/${appId}/namespaces`).reply(200, mockRules);

      const { stdout } = await runCommand(
        ["apps:channel-rules:list"],
        import.meta.url,
      );

      expect(stdout).toContain("Found 2 channel rules");
      expect(stdout).toContain("chat");
      expect(stdout).toContain("events");
    });

    it("should handle empty rules list", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl().get(`/v1/apps/${appId}/namespaces`).reply(200, []);

      const { stdout } = await runCommand(
        ["apps:channel-rules:list"],
        import.meta.url,
      );

      expect(stdout).toContain("No channel rules found");
    });

    it("should display rule details correctly", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockRules = [
        {
          ...mockNamespace({ persisted: true, pushEnabled: true }),
          authenticated: true,
          tlsOnly: true,
        },
      ];

      nockControl().get(`/v1/apps/${appId}/namespaces`).reply(200, mockRules);

      const { stdout } = await runCommand(
        ["apps:channel-rules:list"],
        import.meta.url,
      );

      expect(stdout).toContain("Found 1 channel rules");
      expect(stdout).toContain("chat");
      expect(stdout).toContain("Persisted: ✓ Yes");
      expect(stdout).toContain("Push Enabled: ✓ Yes");
    });

    it("should display mutableMessages in rule details", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockRules = [
        {
          ...mockNamespace({ id: "mutable-chat", persisted: true }),
          mutableMessages: true,
        },
      ];

      nockControl().get(`/v1/apps/${appId}/namespaces`).reply(200, mockRules);

      const { stdout } = await runCommand(
        ["apps:channel-rules:list"],
        import.meta.url,
      );

      expect(stdout).toContain("Found 1 channel rules");
      expect(stdout).toContain("mutable-chat");
      expect(stdout).toContain("Mutable Messages: ✓ Yes");
    });

    it("should include mutableMessages in JSON output", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockRules = [
        {
          ...mockNamespace({ id: "mutable-chat", persisted: true }),
          mutableMessages: true,
        },
        mockNamespace({ id: "regular-chat" }),
      ];

      nockControl().get(`/v1/apps/${appId}/namespaces`).reply(200, mockRules);

      const { stdout } = await runCommand(
        ["apps:channel-rules:list", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result.rules).toHaveLength(2);
      expect(result.rules[0]).toHaveProperty("mutableMessages", true);
      expect(result.rules[1]).toHaveProperty("mutableMessages", false);
    });
  });

  standardHelpTests("apps:channel-rules:list", import.meta.url);
  standardArgValidationTests("apps:channel-rules:list", import.meta.url);
  standardFlagTests("apps:channel-rules:list", import.meta.url, ["--json"]);

  describe("error handling", () => {
    standardControlApiErrorTests({
      commandArgs: ["apps:channel-rules:list"],
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

      const { error } = await runCommand(
        ["apps:channel-rules:list"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/404/);
    });
  });
});
