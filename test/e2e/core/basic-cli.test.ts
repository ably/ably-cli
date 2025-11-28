import {
  describe,
  it,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  expect,
} from "vitest";
import stripAnsi from "strip-ansi";
import { runCommand } from "../../helpers/command-helpers.js";
import {
  forceExit,
  cleanupTrackedResources,
  testOutputFiles,
  testCommands,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";

// Helper function to extract JSON from potentially noisy stdout
// Looks for the last occurrence of { or [ to handle potential prefixes
const _parseJsonFromOutput = (output: string): any => {
  // Strip ANSI color codes first
  const strippedOutput = stripAnsi(output);

  const jsonStart = strippedOutput.lastIndexOf("{");
  const arrayStart = strippedOutput.lastIndexOf("[");
  let startIndex = -1;

  if (jsonStart === -1 && arrayStart === -1) {
    console.error("No JSON start character ({ or [) found.");
    throw new Error(`No JSON object or array found in output.`);
  }

  if (jsonStart !== -1 && arrayStart !== -1) {
    startIndex = Math.max(jsonStart, arrayStart); // Use the later starting character
  } else if (jsonStart === -1) {
    startIndex = arrayStart;
  } else {
    startIndex = jsonStart;
  }

  const jsonString = strippedOutput.slice(Math.max(0, startIndex));
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("JSON parsing failed:", error);
    throw new Error(`Failed to parse JSON from output substring.`);
  }
};

// These tests check the basic CLI functionality in a real environment
describe("Basic CLI E2E", () => {
  beforeAll(() => {
    process.on("SIGINT", forceExit);
  });

  afterAll(() => {
    process.removeListener("SIGINT", forceExit);
  });

  beforeEach(() => {
    resetTestTracking();
    // Clear tracked output files and commands for this test
    testOutputFiles.clear();
    testCommands.length = 0;
  });

  afterEach(async () => {
    await cleanupTrackedResources();
  });

  describe("CLI version", () => {
    it("should output the correct version", async () => {
      setupTestFailureHandler("should output the correct version");

      const result = await runCommand(["--version"], {
        env: { NODE_OPTIONS: "", ABLY_CLI_NON_INTERACTIVE: "true" },
        timeoutMs: 10000,
      });

      expect(result.exitCode).toBe(0);
      // Check if stdout starts with the package name and version format
      expect(result.stdout).toMatch(/^@ably\/cli\/[0-9]+\.[0-9]+\.[0-9]+/);
    });
  });

  describe("Global flags", () => {
    it("should accept --json flag without error", async () => {
      setupTestFailureHandler("should accept --json flag without error");

      // Test --version flag with --json
      const result = await runCommand(["--version", "--json"], {
        env: { NODE_OPTIONS: "", ABLY_CLI_NON_INTERACTIVE: "true" },
        timeoutMs: 10000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe(""); // Ensure no errors

      // Check for valid JSON output
      let jsonOutput;
      expect(() => {
        jsonOutput = JSON.parse(result.stdout);
      }).not.toThrow();

      // Validate the JSON structure
      expect(jsonOutput).toHaveProperty("version");
      expect(typeof jsonOutput.version).toBe("string");
      expect(jsonOutput).toHaveProperty("name", "@ably/cli");
      expect(jsonOutput).toHaveProperty("platform", process.platform);
    });

    it("should accept --pretty-json flag without error", async () => {
      setupTestFailureHandler("should accept --pretty-json flag without error");

      // Test --version flag with --pretty-json
      const result = await runCommand(["--version", "--pretty-json"], {
        env: { NODE_OPTIONS: "", ABLY_CLI_NON_INTERACTIVE: "true" },
        timeoutMs: 10000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe(""); // Ensure no errors

      // Pretty JSON should contain line breaks
      expect(result.stdout).toContain("\n");

      // Check for valid JSON output - use _parseJsonFromOutput helper to handle ANSI color codes
      let jsonOutput;
      expect(() => {
        jsonOutput = _parseJsonFromOutput(result.stdout);
      }).not.toThrow();

      // Validate the JSON structure
      expect(jsonOutput).toHaveProperty("version");
      expect(typeof jsonOutput.version).toBe("string");
      expect(jsonOutput).toHaveProperty("name", "@ably/cli");
      expect(jsonOutput).toHaveProperty("platform", process.platform);
    });

    it("should error when both --json and --pretty-json are used", async () => {
      setupTestFailureHandler(
        "should error when both --json and --pretty-json are used",
      );

      // Test on a base command (`config`) that inherits global flags
      const result = await runCommand(["config", "--json", "--pretty-json"], {
        env: { NODE_OPTIONS: "", ABLY_CLI_NON_INTERACTIVE: "true" },
        timeoutMs: 10000,
      });

      expect(result.exitCode).not.toBe(0); // Command should fail due to exclusive flags
      // Check stderr for the specific error message (oclif v3 style)
      expect(result.stderr).toContain("cannot also be provided");
    });
  });

  describe("CLI help", () => {
    it("should display help for root command", async () => {
      setupTestFailureHandler("should display help for root command");

      const result = await runCommand(["help"], {
        env: { NODE_OPTIONS: "", ABLY_CLI_NON_INTERACTIVE: "true" },
        timeoutMs: 10000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");

      // Check that main topics are listed
      expect(result.stdout).toContain("accounts");
      expect(result.stdout).toContain("apps");
      expect(result.stdout).toContain("channels");
      expect(result.stdout).toContain("auth");
      expect(result.stdout).toContain("config"); // Base topic exists
      expect(result.stdout).toContain("help"); // Help command itself
      expect(result.stdout).toContain("status"); // Status is now root command
      expect(result.stdout).toContain("support"); // Support topic
    });

    it("should fail when attempting to get help for a non-existent command", async () => {
      setupTestFailureHandler(
        "should fail when attempting to get help for a non-existent command",
      );

      // Use the help command on a non-existent command
      const result = await runCommand(["help", "doesnotexist"], {
        env: { NODE_OPTIONS: "", ABLY_CLI_NON_INTERACTIVE: "true" },
        timeoutMs: 5000,
      });

      expect(result.exitCode).not.toBe(0);
      // Should show command not found error
      expect(result.stderr).toContain('Command "doesnotexist" not found');
    });

    it("should display web CLI help when running help with --web-cli-help flag", async () => {
      setupTestFailureHandler(
        "should display web CLI help when running help with --web-cli-help flag",
      );

      const result = await runCommand(["help", "--web-cli-help"], {
        env: { NODE_OPTIONS: "", ABLY_CLI_NON_INTERACTIVE: "true" },
        timeoutMs: 5000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("browser-based CLI");
      expect(result.stdout).toContain("COMMON COMMANDS");
      expect(result.stdout).toContain(
        "Type ably help to see the complete list of commands",
      );
      expect(result.stdout).toContain("Publish a message");
      expect(result.stdout).toContain("Subscribe to a channel");
      // Should NOT include the regular help commands section
      expect(result.stdout).not.toContain("accounts");
      expect(result.stdout).not.toContain("apps");
      expect(result.stdout).not.toContain("Ably help commands:");
    });
  });

  describe("Command not found handling", () => {
    it("should suggest and run similar command for a typo (colon input)", async () => {
      setupTestFailureHandler(
        "should suggest and run similar command for a typo (colon input)",
      );

      const result = await runCommand(["channels:pubish"], {
        env: { NODE_OPTIONS: "", ABLY_CLI_NON_INTERACTIVE: "true" },
        timeoutMs: 5000,
      });

      // Expect specific warning format and failure
      expect(result.stderr).toContain(
        "Warning: channels pubish is not an ably command.",
      ); // Match actual warning
      // Do not expect "Did you mean" in non-interactive output from the hook itself
      expect(result.exitCode).not.toBe(0);
    });

    it("should suggest and run similar command for a typo (space input)", async () => {
      setupTestFailureHandler(
        "should suggest and run similar command for a typo (space input)",
      );

      const result = await runCommand(["channels", "pubish"], {
        env: { NODE_OPTIONS: "", ABLY_CLI_NON_INTERACTIVE: "true" },
        timeoutMs: 5000,
      });

      // Expect specific warning format and failure
      expect(result.stderr).toContain(
        "Warning: channels pubish is not an ably command.",
      ); // Match actual warning
      // Do not expect "Did you mean" in non-interactive output from the hook itself
      expect(result.exitCode).not.toBe(0);
    });

    it("should suggest help for completely unknown commands", async () => {
      setupTestFailureHandler(
        "should suggest help for completely unknown commands",
      );

      const result = await runCommand(
        ["completelyunknowncommand", "--non-interactive"],
        {
          env: { NODE_OPTIONS: "", ABLY_CLI_NON_INTERACTIVE: "true" },
          timeoutMs: 5000,
        },
      );

      expect(result.exitCode).not.toBe(0); // Should fail as no suggestion is found
      // Check stderr for the 'command not found' and help suggestion
      expect(result.stderr).toContain("completelyunknowncommand not found");
      expect(result.stderr).toContain("Run ably --help");
    });

    it("should show command not found for topic typo with subcommand", async () => {
      setupTestFailureHandler(
        "should show command not found for topic typo with subcommand",
      );

      // Example: `ably config doesnotexist` -> input is `config:doesnotexist` internally
      const result = await runCommand(
        ["config", "doesnotexist", "--non-interactive"],
        {
          env: { NODE_OPTIONS: "", ABLY_CLI_NON_INTERACTIVE: "true" },
          timeoutMs: 5000,
        },
      );

      expect(result.exitCode).not.toBe(0);
      // With our updated implementation, it will try to find a close match for "config"
      // and if found, will warn with "config is not an ably command"
      expect(result.stderr).toContain("config is not an ably command");
    });
  });
});
