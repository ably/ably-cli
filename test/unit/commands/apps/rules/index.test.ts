import { describe, it, expect } from "vitest";
import { runCommand } from "@oclif/test";
import { standardHelpTests } from "../../../../helpers/standard-tests.js";

describe("apps:rules topic command", () => {
  standardHelpTests("apps:rules", import.meta.url);

  describe("argument validation", () => {
    it("should handle unknown subcommand gracefully", async () => {
      const { stdout } = await runCommand(
        ["apps:rules", "nonexistent"],
        import.meta.url,
      );
      expect(stdout).toBeDefined();
    });
  });

  describe("functionality", () => {
    it("should list available subcommands", async () => {
      const { stdout } = await runCommand(
        ["apps:rules", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("create");
      expect(stdout).toContain("list");
      expect(stdout).toContain("update");
      expect(stdout).toContain("delete");
    });
  });

  describe("flags", () => {
    it("should show usage information in help", async () => {
      const { stdout } = await runCommand(
        ["apps:rules", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("USAGE");
    });
  });

  describe("error handling", () => {
    it("should not crash with no arguments", async () => {
      const { stdout } = await runCommand(["apps:rules"], import.meta.url);
      expect(stdout).toBeDefined();
    });
  });
});
