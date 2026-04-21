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
  SHOULD_SKIP_E2E,
  getUniqueChannelName,
  createTempOutputFile,
  runLongRunningBackgroundProcess,
  readProcessOutput,
  publishTestMessage,
  killProcess,
  forceExit,
  cleanupTrackedResources,
  testOutputFiles,
  testCommands,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import { runCommand } from "../../helpers/command-helpers.js";
import { ChildProcess } from "node:child_process";

describe("Channel Subscribe E2E Tests", () => {
  // Skip all tests if API key not available
  beforeAll(async () => {
    if (SHOULD_SKIP_E2E) {
      return;
    }
    process.on("SIGINT", forceExit);
  });

  afterAll(() => {
    process.removeListener("SIGINT", forceExit);
  });

  let subscribeChannel: string;
  let outputPath: string;
  let subscribeProcessInfo: {
    process: ChildProcess;
    processId: string;
  } | null = null;

  beforeEach(async () => {
    resetTestTracking();
    // Clear tracked commands and output files before each test
    testOutputFiles.clear();
    testCommands.length = 0;
    subscribeChannel = getUniqueChannelName("subscribe");
    outputPath = await createTempOutputFile();
  });

  afterEach(async () => {
    // Kill specific process if necessary
    if (subscribeProcessInfo) {
      await killProcess(subscribeProcessInfo.process);
      subscribeProcessInfo = null;
    }
    // Perform E2E cleanup
    await cleanupTrackedResources();
  });

  // Test subscribe functionality - subscribe in one process, publish in another
  it("should subscribe to a channel and receive messages", async () => {
    setupTestFailureHandler(
      "should subscribe to a channel and receive messages",
    );

    // Skip if E2E tests should be skipped
    if (SHOULD_SKIP_E2E) {
      return;
    }

    const readySignal = "Subscribed to channel"; // Wait for channel to be fully attached

    // Start the subscribe process, waiting for the ready signal
    subscribeProcessInfo = await runLongRunningBackgroundProcess(
      `bin/run.js channels subscribe ${subscribeChannel}`,
      outputPath,
      { readySignal, timeoutMs: 15000 }, // Pass signal and a 15s timeout
    );
    // If the above promise resolved, the process is ready.
    console.log(
      `[Test Subscribe] Background subscriber process ${subscribeProcessInfo.processId} ready.`,
    );

    // Publish a message to the channel
    console.log(
      `[Test Subscribe] Publishing message to ${subscribeChannel}...`,
    );
    const testMessage = { text: "Subscribe E2E Test" };
    await publishTestMessage(subscribeChannel, testMessage);
    console.log(`[Test Subscribe] Message published.`);

    // Wait for the subscribe process to receive the message
    console.log(
      `[Test Subscribe] Waiting for message in output file ${outputPath}...`,
    );
    let messageReceived = false;
    // Poll for a reasonable time after publishing
    for (let i = 0; i < 50; i++) {
      // ~7.5 seconds polling
      const output = await readProcessOutput(outputPath);
      if (output.includes("Subscribe E2E Test")) {
        console.log(`[Test Subscribe] Message received in output.`);
        messageReceived = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    if (!messageReceived) {
      const finalOutput = await readProcessOutput(outputPath);
      console.error(
        `[Test Subscribe] FAILED TO FIND MESSAGE. Final output:\n${finalOutput}`,
      );
    }
    expect(messageReceived).toBe(true);
    // Cleanup is handled by afterEach hook
  });

  // End-to-end: both subscriber AND publisher run through the CLI subprocess —
  // not the SDK — so regressions in the CLI publish path surface here.
  it("should deliver a CLI-published message to a CLI subscriber", async () => {
    setupTestFailureHandler(
      "should deliver a CLI-published message to a CLI subscriber",
    );

    if (SHOULD_SKIP_E2E) return;

    const readySignal = "Subscribed to channel";

    subscribeProcessInfo = await runLongRunningBackgroundProcess(
      `bin/run.js channels subscribe ${subscribeChannel}`,
      outputPath,
      { readySignal, timeoutMs: 15000 },
    );

    const messageText = `cli-to-cli-${Date.now()}`;
    const publishResult = await runCommand([
      "channels",
      "publish",
      subscribeChannel,
      messageText,
    ]);
    expect(publishResult.exitCode).toBe(0);

    let messageReceived = false;
    for (let i = 0; i < 50; i++) {
      const output = await readProcessOutput(outputPath);
      if (output.includes(messageText)) {
        messageReceived = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    if (!messageReceived) {
      const finalOutput = await readProcessOutput(outputPath);
      console.error(
        `[Test CLI-to-CLI] FAILED. Final subscriber output:\n${finalOutput}`,
      );
    }
    expect(messageReceived).toBe(true);
  });
});
