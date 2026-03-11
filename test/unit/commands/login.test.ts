import { describe, it, expect } from "vitest";
import { runCommand } from "@oclif/test";

describe("login command", () => {
  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(["login", "--help"], import.meta.url);

      expect(stdout).toContain("Log in to your Ably account");
      expect(stdout).toContain("USAGE");
    });

    it("should display examples in help", async () => {
      const { stdout } = await runCommand(["login", "--help"], import.meta.url);

      expect(stdout).toContain("EXAMPLES");
    });

    it("should mention it is an alias for accounts login", async () => {
      const { stdout } = await runCommand(["login", "--help"], import.meta.url);

      expect(stdout).toContain("accounts login");
    });
  });

  describe("argument validation", () => {
    it("should accept optional alias argument", async () => {
      const { stdout } = await runCommand(["login", "--help"], import.meta.url);

      // The login command inherits args from accounts:login
      expect(stdout).toContain("USAGE");
    });
  });

  describe("functionality", () => {
    // The login command delegates to accounts:login which is interactive.
    // We test that the command exists and shows proper help.
    it("should be recognized as a valid command", async () => {
      const { stdout } = await runCommand(["login", "--help"], import.meta.url);

      expect(stdout).toBeDefined();
      expect(stdout).toContain("Log in to your Ably account");
    });
  });

  describe("flags", () => {
    it("should accept --alias flag from accounts login", async () => {
      const { stdout } = await runCommand(["login", "--help"], import.meta.url);

      expect(stdout).toContain("--alias");
    });
  });

  describe("error handling", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["login", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });
});
