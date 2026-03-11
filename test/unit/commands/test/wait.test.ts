import { describe, it, expect } from "vitest";
import { runCommand } from "@oclif/test";

describe("test:wait command", () => {
  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["test:wait", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain(
        "Test command that waits for a specified duration",
      );
      expect(stdout).toContain("USAGE");
    });

    it("should display examples in help", async () => {
      const { stdout } = await runCommand(
        ["test:wait", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("EXAMPLES");
    });
  });

  describe("argument validation", () => {
    it("should require --duration flag", async () => {
      const { error } = await runCommand(["test:wait"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Missing required flag.*duration/i);
    });
  });

  describe("functionality", () => {
    it("should wait for the specified duration and complete", async () => {
      const { stdout } = await runCommand(
        ["test:wait", "--duration", "1"],
        import.meta.url,
      );

      expect(stdout).toContain("Waiting for 1 seconds");
      expect(stdout).toContain("Wait completed successfully");
    }, 5000);

    it("should accept -d as alias for --duration", async () => {
      const { stdout } = await runCommand(
        ["test:wait", "-d", "1"],
        import.meta.url,
      );

      expect(stdout).toContain("Waiting for 1 seconds");
    }, 5000);
  });

  describe("flags", () => {
    it("should accept --duration flag", async () => {
      const { stdout } = await runCommand(
        ["test:wait", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--duration");
      expect(stdout).toContain("-d");
    });
  });

  describe("error handling", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["test:wait", "--duration", "1", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });
});
