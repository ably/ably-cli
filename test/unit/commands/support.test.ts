import { describe, it, expect } from "vitest";
import { runCommand } from "@oclif/test";

describe("support command", () => {
  describe("topic listing", () => {
    it("should list available support subcommands when run without arguments", async () => {
      const { stdout } = await runCommand(["support"], import.meta.url);

      expect(stdout).toContain("Ably support commands:");
      expect(stdout).toContain("support ask");
      expect(stdout).toContain("support contact");
    });

    it("should display help hint for subcommands", async () => {
      const { stdout } = await runCommand(["support"], import.meta.url);

      expect(stdout).toContain("--help");
      expect(stdout).toContain("for more information");
    });
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["support", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Get support and help from Ably");
      expect(stdout).toContain("USAGE");
    });

    it("should display help with -h flag", async () => {
      const { stdout } = await runCommand(["support", "-h"], import.meta.url);

      expect(stdout).toContain("Get support and help from Ably");
      expect(stdout).toContain("USAGE");
    });
  });

  describe("unknown subcommand", () => {
    it("should show warning for unknown subcommand", async () => {
      // Set environment to skip confirmation prompts
      const originalEnv = process.env.ABLY_CLI_NON_INTERACTIVE;
      process.env.ABLY_CLI_NON_INTERACTIVE = "true";

      try {
        const { stdout, stderr } = await runCommand(
          ["support", "unknowncommand"],
          import.meta.url,
        );

        // Should show error or warning about command not found
        const output = stdout + (stderr || "");
        expect(output).toMatch(/not found|not.*command|available/i);
      } finally {
        if (originalEnv === undefined) {
          delete process.env.ABLY_CLI_NON_INTERACTIVE;
        } else {
          process.env.ABLY_CLI_NON_INTERACTIVE = originalEnv;
        }
      }
    });
  });

  describe("subcommand routing", () => {
    it("should route to support:ask when ask subcommand is provided", async () => {
      // The ask command requires a question, so we test with --help
      const { stdout } = await runCommand(
        ["support", "ask", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("USAGE");
      // The help should be for the ask command specifically
      expect(stdout).toMatch(/ask|AI|question/i);
    });

    it("should route to support:contact when contact subcommand is provided", async () => {
      const { stdout } = await runCommand(
        ["support", "contact", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("USAGE");
      expect(stdout).toMatch(/contact|support/i);
    });
  });
});
