import {
  describe,
  it,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  expect,
} from "vitest";
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

describe("Channel History E2E Tests", () => {
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

  // Test history functionality - publish messages with CLI then retrieve history
  it("should publish messages and retrieve history with CLI", async () => {
    setupTestFailureHandler(
      "should publish messages and retrieve history with CLI",
    );

    // Skip if E2E tests should be skipped
    if (SHOULD_SKIP_E2E) {
      return;
    }

    // Verify API key is available
    if (!E2E_API_KEY) {
      throw new Error("E2E_API_KEY is not available for testing");
    }

    const historyChannel = getUniqueChannelName("cli-history");
    const testMessages = [
      "CLI History Test Message 1",
      "CLI History Test Message 2",
      "CLI History Test Message 3",
    ];

    // Publish messages using the CLI
    for (let i = 0; i < testMessages.length; i++) {
      console.log(
        `Publishing message ${i + 1}: ${testMessages[i]} to channel: ${historyChannel}`,
      );

      const publishResult = await runCommand(
        [
          "channels",
          "publish",
          historyChannel,
          JSON.stringify({ text: testMessages[i] }),
        ],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(publishResult.exitCode).toBe(0);

      // Check if publish stdout is empty and provide diagnostic info
      if (!publishResult.stdout || publishResult.stdout.trim() === "") {
        throw new Error(
          `Publish command returned empty output. Exit code: ${publishResult.exitCode}, stderr: "${publishResult.stderr}", stdout: "${publishResult.stdout}"`,
        );
      }

      expect(publishResult.stdout).toContain(
        `Message published successfully to channel "${historyChannel}"`,
      );
    }

    // Add a delay to ensure messages are stored
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Retrieve history using the CLI
    const historyResult = await runCommand(
      ["channels", "history", historyChannel],
      {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 30000,
      },
    );

    expect(historyResult.exitCode).toBe(0);

    // Check if stdout is empty and provide diagnostic info
    if (!historyResult.stdout || historyResult.stdout.trim() === "") {
      throw new Error(
        `History command returned empty output. Exit code: ${historyResult.exitCode}, stderr: "${historyResult.stderr}", stdout: "${historyResult.stdout}"`,
      );
    }

    // Verify all messages are in the history
    for (const message of testMessages) {
      expect(historyResult.stdout).toContain(message);
    }
  });
});
