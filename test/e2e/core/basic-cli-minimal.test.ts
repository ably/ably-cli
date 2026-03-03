import {
  describe,
  it,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  expect,
} from "vitest";
import { runCommand } from "../../helpers/command-helpers.js";
import {
  forceExit,
  cleanupTrackedResources,
  testOutputFiles,
  testCommands,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";

// Options for runCommand to prevent Node debugger attachment/output
const commandOptions = {
  env: { NODE_OPTIONS: "--no-inspect" }, // Clear NODE_OPTIONS to prevent debugger attachment
  timeoutMs: 5000, // 5 second timeout for commands
};

// Very simple tests to see if the CLI works at all
describe("Minimal CLI E2E Tests", () => {
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

  it("should output the version", async () => {
    setupTestFailureHandler("should output the version");

    const result = await runCommand(["--version"], commandOptions);

    // Basic check for successful command
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/^@ably\/cli\/[0-9]+\.[0-9]+\.[0-9]+/);
  });

  it("should output JSON version info", async () => {
    setupTestFailureHandler("should output JSON version info");

    const result = await runCommand(["--version", "--json"], commandOptions);

    // Basic JSON check
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveProperty("version");
  });

  it("should show help text", async () => {
    setupTestFailureHandler("should show help text");

    const result = await runCommand(["help"], commandOptions);

    // Basic help check
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("help");
    expect(result.stdout).toContain("support");
    expect(result.stdout).toContain("status");
  });
});
