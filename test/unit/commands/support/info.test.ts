import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";

describe("support:info command", () => {
  const originalEnv = process.env.ABLY_WEB_CLI_MODE;

  afterEach(() => {
    // Restore original environment
    if (originalEnv === undefined) {
      delete process.env.ABLY_WEB_CLI_MODE;
    } else {
      process.env.ABLY_WEB_CLI_MODE = originalEnv;
    }

    vi.clearAllMocks();
  });

  describe("normal CLI mode", () => {
    beforeEach(() => {
      delete process.env.ABLY_WEB_CLI_MODE;
    });

    it("should open browser with support URL", async () => {
      const { stdout } = await runCommand(["support:info"], import.meta.url);

      expect(stdout).toContain("Opening");
      expect(stdout).toContain("https://ably.com/support");
      expect(stdout).toContain("in your browser");
      expect(stdout).toContain(
        "would open URL in browser: https://ably.com/support",
      );
    });

    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["support:info", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("General support resources and documentation");
      expect(stdout).toContain("USAGE");
    });

    it("should display help with -h flag", async () => {
      const { stdout } = await runCommand(
        ["support:info", "-h"],
        import.meta.url,
      );

      expect(stdout).toContain("General support resources and documentation");
      expect(stdout).toContain("USAGE");
    });
  });

  describe("web CLI mode", () => {
    beforeEach(() => {
      process.env.ABLY_WEB_CLI_MODE = "true";
    });

    it("should display URL without opening browser in web CLI mode", async () => {
      const { stdout } = await runCommand(["support:info"], import.meta.url);

      expect(stdout).toContain("Support resources:");
      expect(stdout).toContain("https://ably.com/support");
      expect(stdout).not.toContain("Opening");
      expect(stdout).not.toContain("in your browser");
      expect(stdout).not.toContain(
        "would open URL in browser: https://ably.com/support",
      );
    });

    it("should handle web CLI mode with --help flag", async () => {
      const { stdout } = await runCommand(
        ["support:info", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("General support resources and documentation");
      expect(stdout).toContain("USAGE");
    });
  });

  describe("edge cases", () => {
    it("should handle ABLY_WEB_CLI_MODE set to false", async () => {
      process.env.ABLY_WEB_CLI_MODE = "false";

      const { stdout } = await runCommand(["support:info"], import.meta.url);

      // Should behave like normal mode (not web CLI mode)
      expect(stdout).toContain("Opening");
      expect(stdout).toContain("https://ably.com/support");
      expect(stdout).toContain("in your browser");
      expect(stdout).toContain(
        "would open URL in browser: https://ably.com/support",
      );
    });

    it("should handle ABLY_WEB_CLI_MODE set to empty string", async () => {
      process.env.ABLY_WEB_CLI_MODE = "";

      const { stdout } = await runCommand(["support:info"], import.meta.url);

      // Should behave like normal mode (not web CLI mode)
      expect(stdout).toContain("Opening");
      expect(stdout).toContain("https://ably.com/support");
      expect(stdout).toContain("in your browser");
      expect(stdout).toContain(
        "would open URL in browser: https://ably.com/support",
      );
    });
  });
});
