import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";

describe("channel-rule:list command (alias)", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  describe("functionality", () => {
    it("should execute the same as apps:channel-rules:list", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, [
          {
            id: "rule1",
            persisted: true,
            pushEnabled: false,
            created: Date.now(),
            modified: Date.now(),
          },
          {
            id: "rule2",
            persisted: false,
            pushEnabled: true,
            created: Date.now(),
            modified: Date.now(),
          },
        ]);

      const { stdout } = await runCommand(
        ["channel-rule:list"],
        import.meta.url,
      );

      expect(stdout).toContain("rule1");
      expect(stdout).toContain("rule2");
    });

    it("should show message when no rules found", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(200, []);

      const { stdout } = await runCommand(
        ["channel-rule:list"],
        import.meta.url,
      );

      expect(stdout).toContain("No channel rules found");
    });
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["channel-rule:list", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("USAGE");
    });
  });

  describe("argument validation", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["channel-rule:list", "--unknown-flag-xyz"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("flags", () => {
    it("should accept --json flag", async () => {
      const { stdout } = await runCommand(
        ["channel-rule:list", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("--json");
    });
  });

  describe("error handling", () => {
    it("should handle API errors gracefully", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .get(`/v1/apps/${appId}/namespaces`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["channel-rule:list"],
        import.meta.url,
      );
      expect(error).toBeDefined();
    });
  });
});
