import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";

describe("channel-rule:create command (alias)", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  describe("functionality", () => {
    it("should execute the same as apps:channel-rules:create", async () => {
      const appId = getMockConfigManager().getCurrentAppId()!;
      nock("https://control.ably.net")
        .post(`/v1/apps/${appId}/namespaces`)
        .reply(200, {
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
      expect(error!.message).toMatch(/Missing required flag.*name/);
    });
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["channel-rule:create", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("USAGE");
    });
  });

  describe("argument validation", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["channel-rule:create", "--unknown-flag-xyz"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("flags", () => {
    it("should accept --json flag", async () => {
      const { stdout } = await runCommand(
        ["channel-rule:create", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("--json");
    });
  });

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
