import {
  describe,
  it,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  expect,
} from "vitest";
import { randomUUID } from "node:crypto";
import {
  E2E_API_KEY,
  SHOULD_SKIP_E2E,
  getUniqueChannelName,
  forceExit,
  cleanupTrackedResources,
  testOutputFiles,
  testCommands,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import { runCommand } from "../../helpers/command-helpers.js";

describe("Channel Presence E2E Tests", () => {
  // Skip all tests if API key not available
  beforeAll(() => {
    if (SHOULD_SKIP_E2E) {
      return;
    }
    process.on("SIGINT", forceExit);
  });

  afterAll(() => {
    process.removeListener("SIGINT", forceExit);
  });

  beforeEach(() => {
    resetTestTracking();
    // Clear tracked commands and output files before each test
    testOutputFiles.clear();
    testCommands.length = 0;
  });

  afterEach(async () => {
    await cleanupTrackedResources();
  });

  // Test presence functionality - simplified to enter/exit only since list command doesn't exist
  it("should enter and exit presence on a channel", async () => {
    setupTestFailureHandler("should enter and exit presence on a channel");

    // Skip if E2E tests should be skipped
    if (SHOULD_SKIP_E2E) {
      return;
    }

    const presenceChannel = getUniqueChannelName("presence");
    const clientId = `cli-e2e-test-${randomUUID()}`;
    const clientData = { name: "E2E Test Client" };

    console.log(
      `Using presence channel: ${presenceChannel} with client ID: ${clientId}`,
    );

    // Enter the presence channel using the CLI (exit after 2 seconds)
    const enterResult = await runCommand(
      [
        "channels",
        "presence",
        "enter",
        presenceChannel,
        "--client-id",
        clientId,
        "--data",
        JSON.stringify(clientData),
        "--duration",
        "2",
      ],
      {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 30000,
      },
    );

    console.log(`Presence enter output: ${enterResult.stdout}`);
    expect(enterResult.exitCode).toBe(0);
    expect(enterResult.stdout).toContain("Entered channel");
    expect(enterResult.stdout).toContain(
      "Duration elapsed – command finished cleanly",
    );
  });
});
