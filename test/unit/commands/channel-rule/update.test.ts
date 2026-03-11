import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";

describe("channel-rule:update command (alias)", () => {
  const mockRuleId = "test-rule";

  afterEach(() => {
    nock.cleanAll();
  });

  describe("functionality", () => {
    it("should execute the same as apps:channel-rules:update", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
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

      nock("https://control.ably.net")
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
      expect(error!.message).toMatch(/Missing 1 required arg/);
    });
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["channel-rule:update", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("USAGE");
    });
  });

  describe("argument validation", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["channel-rule:update", "--unknown-flag-xyz"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("flags", () => {
    it("should accept --json flag", async () => {
      const { stdout } = await runCommand(
        ["channel-rule:update", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("--json");
    });
  });

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
