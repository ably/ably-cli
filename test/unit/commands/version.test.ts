import { describe, it, expect } from "vitest";
import { runCommand } from "@oclif/test";

describe("version command", () => {
  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["version", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Display CLI version information");
      expect(stdout).toContain("USAGE");
    });
  });

  describe("argument validation", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["version", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("functionality", () => {
    it("should display version information", async () => {
      const { stdout } = await runCommand(["version"], import.meta.url);

      // Version output should contain platform info and node version
      expect(stdout).toContain(process.platform);
      expect(stdout).toContain(process.version);
    });

    it("should display Public Preview status", async () => {
      const { stdout } = await runCommand(["version"], import.meta.url);

      expect(stdout).toContain("Public Preview");
      expect(stdout).toContain("Version");
    });

    it("should output JSON when --json flag is used", async () => {
      const { stdout } = await runCommand(
        ["version", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "version");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("version");
      expect(result).toHaveProperty("name");
      expect(result).toHaveProperty("arch");
      expect(result).toHaveProperty("nodeVersion");
      expect(result).toHaveProperty("platform");
    });
  });

  describe("flags", () => {
    it("should accept --json flag", async () => {
      const { stdout } = await runCommand(
        ["version", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--json");
    });

    it("should accept --pretty-json flag", async () => {
      const { stdout } = await runCommand(
        ["version", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--pretty-json");
    });
  });

  describe("error handling", () => {
    it("should not error when run without arguments", async () => {
      const { stdout, error } = await runCommand(["version"], import.meta.url);

      expect(error).toBeUndefined();
      expect(stdout).toBeTruthy();
    });
  });
});
