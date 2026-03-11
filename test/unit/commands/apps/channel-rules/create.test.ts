import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import {
  nockControl,
  controlApiCleanup,
} from "../../../../helpers/control-api-test-helpers.js";
import { getMockConfigManager } from "../../../../helpers/mock-config-manager.js";
import {
  standardHelpTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("apps:channel-rules:create command", () => {
  const mockRuleName = "chat";
  const mockRuleId = "chat";

  afterEach(() => {
    controlApiCleanup();
  });

  describe("functionality", () => {
    it("should create a channel rule successfully", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl().post(`/v1/apps/${appId}/namespaces`).reply(201, {
        id: mockRuleId,
        persisted: false,
        pushEnabled: false,
        created: Date.now(),
        modified: Date.now(),
      });

      const { stdout } = await runCommand(
        ["apps:channel-rules:create", "--name", mockRuleName],
        import.meta.url,
      );

      expect(stdout).toContain("Channel rule created.");
      expect(stdout).toContain(mockRuleId);
    });

    it("should create a channel rule with persisted flag", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .post(`/v1/apps/${appId}/namespaces`, (body) => {
          return body.persisted === true;
        })
        .reply(201, {
          id: mockRuleId,
          persisted: true,
          pushEnabled: false,
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout } = await runCommand(
        ["apps:channel-rules:create", "--name", mockRuleName, "--persisted"],
        import.meta.url,
      );

      expect(stdout).toContain("Channel rule created.");
      expect(stdout).toContain("Persisted: Yes");
    });

    it("should create a channel rule with push-enabled flag", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .post(`/v1/apps/${appId}/namespaces`, (body) => {
          return body.pushEnabled === true;
        })
        .reply(201, {
          id: mockRuleId,
          persisted: false,
          pushEnabled: true,
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout } = await runCommand(
        ["apps:channel-rules:create", "--name", mockRuleName, "--push-enabled"],
        import.meta.url,
      );

      expect(stdout).toContain("Channel rule created.");
      expect(stdout).toContain("Push Enabled: Yes");
    });

    it("should create a channel rule with mutable-messages flag and auto-enable persisted", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .post(`/v1/apps/${appId}/namespaces`, (body) => {
          return body.mutableMessages === true && body.persisted === true;
        })
        .reply(201, {
          id: mockRuleId,
          persisted: true,
          pushEnabled: false,
          mutableMessages: true,
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout, stderr } = await runCommand(
        [
          "apps:channel-rules:create",
          "--name",
          mockRuleName,
          "--mutable-messages",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Channel rule created.");
      expect(stdout).toContain("Persisted: Yes");
      expect(stdout).toContain("Mutable Messages: Yes");
      expect(stderr).toContain(
        "Message persistence is automatically enabled when mutable messages is enabled.",
      );
    });

    it("should include mutableMessages in JSON output when --mutable-messages is used", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .post(`/v1/apps/${appId}/namespaces`, (body) => {
          return body.mutableMessages === true && body.persisted === true;
        })
        .reply(201, {
          id: mockRuleId,
          persisted: true,
          pushEnabled: false,
          mutableMessages: true,
          created: Date.now(),
          modified: Date.now(),
        });

      const { stdout, stderr } = await runCommand(
        [
          "apps:channel-rules:create",
          "--name",
          mockRuleName,
          "--mutable-messages",
          "--json",
        ],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result.rule).toHaveProperty("mutableMessages", true);
      expect(result.rule).toHaveProperty("persisted", true);
      // Warning should not appear in JSON mode
      expect(stderr).not.toContain("Warning");
    });

    it("should output JSON format when --json flag is used", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      const mockRule = {
        id: mockRuleId,
        persisted: false,
        pushEnabled: false,
        created: Date.now(),
        modified: Date.now(),
      };

      nockControl().post(`/v1/apps/${appId}/namespaces`).reply(201, mockRule);

      const { stdout } = await runCommand(
        ["apps:channel-rules:create", "--name", mockRuleName, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("rule");
      expect(result.rule).toHaveProperty("id", mockRuleId);
    });
  });

  standardHelpTests("apps:channel-rules:create", import.meta.url);

  describe("argument validation", () => {
    it("should require --name flag", async () => {
      const { error } = await runCommand(
        ["apps:channel-rules:create"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Missing required flag.*name/);
    });
  });

  standardFlagTests("apps:channel-rules:create", import.meta.url, ["--json"]);

  describe("error handling", () => {
    it("should require name parameter", async () => {
      const { error } = await runCommand(
        ["apps:channel-rules:create"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Missing required flag.*name/);
    });

    it("should handle 401 authentication error", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .post(`/v1/apps/${appId}/namespaces`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["apps:channel-rules:create", "--name", mockRuleName],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/401/);
    });

    it("should handle 400 validation error", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .post(`/v1/apps/${appId}/namespaces`)
        .reply(400, { error: "Validation failed" });

      const { error } = await runCommand(
        ["apps:channel-rules:create", "--name", mockRuleName],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/400/);
    });

    it("should handle network errors", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nockControl()
        .post(`/v1/apps/${appId}/namespaces`)
        .replyWithError("Network error");

      const { error } = await runCommand(
        ["apps:channel-rules:create", "--name", mockRuleName],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Network error/);
    });
  });
});
