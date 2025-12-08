import { describe, it, expect } from "vitest";
import { runCommand } from "@oclif/test";

describe("help command", () => {
  describe("root help", () => {
    it("should display root help with available commands", async () => {
      const { stdout } = await runCommand(["help"], import.meta.url);

      expect(stdout).toContain("ably");
      expect(stdout).toContain("COMMANDS");
    });

    it("should display version information", async () => {
      const { stdout } = await runCommand(["help"], import.meta.url);

      // The help output includes version in the header
      expect(stdout).toMatch(/version|Version/i);
    });
  });

  describe("command-specific help", () => {
    it("should display help for channels command", async () => {
      const { stdout } = await runCommand(
        ["help", "channels"],
        import.meta.url,
      );

      expect(stdout).toContain("channels");
      expect(stdout).toMatch(/publish|subscribe|list/i);
    });

    it("should display help for nested command (channels publish)", async () => {
      const { stdout } = await runCommand(
        ["help", "channels", "publish"],
        import.meta.url,
      );

      expect(stdout).toContain("publish");
      expect(stdout).toContain("USAGE");
    });

    it("should display help for accounts command", async () => {
      const { stdout } = await runCommand(
        ["help", "accounts"],
        import.meta.url,
      );

      expect(stdout).toContain("accounts");
      expect(stdout).toMatch(/login|logout|list/i);
    });

    it("should display help for status command", async () => {
      const { stdout } = await runCommand(["help", "status"], import.meta.url);

      expect(stdout).toContain("status");
      expect(stdout).toContain("Ably");
    });
  });

  describe("error handling", () => {
    it("should show error for unknown command", async () => {
      const { error } = await runCommand(
        ["help", "unknowncommand"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("not found");
    });

    it("should show error for unknown nested command", async () => {
      const { error } = await runCommand(
        ["help", "channels", "unknownsubcommand"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("not found");
    });
  });

  describe("help flag on commands", () => {
    it("should display help when --help is passed to any command", async () => {
      const { stdout } = await runCommand(
        ["channels:publish", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("USAGE");
      expect(stdout).toContain("publish");
    });
  });
});
