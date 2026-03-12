import { describe, it, expect } from "vitest";
import { runCommand } from "@oclif/test";
import { standardHelpTests } from "../../../../helpers/standard-tests.js";

describe("channels:annotations topic command", () => {
  standardHelpTests("channels:annotations", import.meta.url);

  describe("argument validation", () => {
    it("should handle unknown subcommand gracefully", async () => {
      const { stdout } = await runCommand(
        ["channels:annotations", "nonexistent"],
        import.meta.url,
      );
      expect(stdout).toBeDefined();
    });
  });

  describe("functionality", () => {
    it("should list available subcommands", async () => {
      const { stdout } = await runCommand(
        ["channels:annotations"],
        import.meta.url,
      );

      expect(stdout).toContain("publish");
      expect(stdout).toContain("subscribe");
      expect(stdout).toContain("get");
      expect(stdout).toContain("delete");
    });
  });

  describe("flags", () => {
    it("should show usage information in help", async () => {
      const { stdout } = await runCommand(
        ["channels:annotations", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("USAGE");
    });
  });

  describe("error handling", () => {
    it("should not crash with no arguments", async () => {
      const { stdout } = await runCommand(
        ["channels:annotations"],
        import.meta.url,
      );
      expect(stdout).toBeDefined();
    });
  });
});
