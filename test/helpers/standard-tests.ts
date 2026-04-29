/**
 * Shared standard test generators for the 5 required describe blocks.
 *
 * Usage:
 *   import { standardHelpTests, standardArgValidationTests, standardFlagTests, standardControlApiErrorTests } from "../../helpers/standard-tests.js";
 *
 *   describe("my:command", () => {
 *     standardHelpTests("my:command", import.meta.url);
 *     standardArgValidationTests("my:command", import.meta.url);
 *     standardFlagTests("my:command", import.meta.url, ["--json", "--app"]);
 *
 *     describe("error handling", () => {
 *       standardControlApiErrorTests({
 *         commandArgs: ["my:command"],
 *         importMetaUrl: import.meta.url,
 *         setupNock: (scenario) => { ... },
 *       });
 *       // command-specific error tests...
 *     });
 *   });
 */
import { describe, it, expect } from "vitest";
import { runCommand } from "@oclif/test";

/**
 * Generate a standard "help" describe block.
 */
export function standardHelpTests(
  command: string,
  importMetaUrl: string,
): void {
  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand([command, "--help"], importMetaUrl);
      expect(stdout).toContain("USAGE");
    });
  });
}

/**
 * Generate a standard "argument validation" describe block.
 * If requiredArgs is provided, tests that missing args produce an error.
 * Always tests that unknown flags are rejected.
 */
export function standardArgValidationTests(
  command: string,
  importMetaUrl: string,
  options?: { requiredArgs?: string[] },
): void {
  describe("argument validation", () => {
    if (options?.requiredArgs) {
      it("should require arguments", async () => {
        const { error } = await runCommand([command], importMetaUrl);
        expect(error).toBeDefined();
        expect(error?.message).toMatch(/required|Missing/i);
      });
    }

    it("should reject unknown flags", async () => {
      const args = options?.requiredArgs
        ? [command, ...options.requiredArgs, "--unknown-flag-xyz"]
        : [command, "--unknown-flag-xyz"];
      const { error } = await runCommand(args, importMetaUrl);
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });
}

/**
 * Generate a standard "flags" describe block.
 * Checks that each listed flag appears in --help output.
 */
export function standardFlagTests(
  command: string,
  importMetaUrl: string,
  flags: string[],
): void {
  describe("flags", () => {
    for (const flag of flags) {
      it(`should accept ${flag} flag`, async () => {
        const { stdout } = await runCommand([command, "--help"], importMetaUrl);
        expect(stdout).toContain(flag);
      });
    }
  });
}

/**
 * Options for standardControlApiErrorTests.
 */
interface ControlApiErrorTestOptions {
  /** Command args for runCommand, e.g., ["apps:create", "test"] */
  commandArgs: string[];
  /** import.meta.url of the test file */
  importMetaUrl: string;
  /** Set up nock to return the specified error. Called before runCommand. */
  setupNock: (scenario: "401" | "500" | "network") => void;
}

/**
 * Generate standard 401/500/network error tests for Control API commands.
 *
 * Call INSIDE a `describe("error handling", ...)` block — does NOT create
 * the describe block itself. Command-specific error tests (403, 404, 429,
 * validation) go alongside these in the same describe.
 */
export function standardControlApiErrorTests(
  opts: ControlApiErrorTestOptions,
): void {
  it("should handle 401 authentication error", async () => {
    opts.setupNock("401");
    const { error } = await runCommand(opts.commandArgs, opts.importMetaUrl);
    expect(error).toBeDefined();
  });

  it("should handle 500 server error", async () => {
    opts.setupNock("500");
    const { error } = await runCommand(opts.commandArgs, opts.importMetaUrl);
    expect(error).toBeDefined();
  });

  it("should handle network errors", async () => {
    opts.setupNock("network");
    const { error } = await runCommand(opts.commandArgs, opts.importMetaUrl);
    expect(error).toBeDefined();
  });
}
