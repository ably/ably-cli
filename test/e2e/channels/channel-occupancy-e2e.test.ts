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
  runBackgroundProcessAndGetOutput,
  killProcess,
  forceExit,
  cleanupTrackedResources,
  testOutputFiles,
  testCommands,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import { ChildProcess } from "node:child_process";

describe("Channel Occupancy E2E Tests", () => {
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

  let occupancyChannel: string;
  let outputPath: string;

  beforeEach(async () => {
    resetTestTracking();
    // Clear tracked commands and output files before each test
    testOutputFiles.clear();
    testCommands.length = 0;
    occupancyChannel = getUniqueChannelName("occupancy");
    outputPath = await createTempOutputFile();
  });

  afterEach(async () => {
    await cleanupTrackedResources();
  });

  it("should get channel occupancy with REST API", async () => {
    setupTestFailureHandler("should get channel occupancy with REST API");

    // Skip if E2E tests should be skipped
    if (SHOULD_SKIP_E2E) {
      return;
    }

    let subscribeProcess: ChildProcess | null = null;

    try {
      // Start a background subscriber process
      console.log(
        `Starting background subscriber for channel ${occupancyChannel}`,
      );
      const subscribeInfo = await runLongRunningBackgroundProcess(
        `bin/run.js channels subscribe ${occupancyChannel} --duration 20`,
        outputPath,
        {
          readySignal: "Successfully attached to channel",
          timeoutMs: process.env.CI ? 20000 : 15000, // Increased timeout for CI
          retryCount: 2,
        },
      );
      subscribeProcess = subscribeInfo.process;

      console.log(
        `Background subscriber process started (PID: ${subscribeProcess.pid})`,
      );

      // Wait longer for the subscriber to be fully counted by Ably in CI
      const waitTime = process.env.CI ? 4000 : 2000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      // Run the occupancy get command
      console.log(`Getting occupancy for channel ${occupancyChannel}`);
      const occupancyResult = await runBackgroundProcessAndGetOutput(
        `bin/run.js channels occupancy get ${occupancyChannel}`,
        process.env.CI ? 15000 : 10000, // Increased timeout for CI
      );

      console.log(`Occupancy result stdout: ${occupancyResult.stdout}`);
      console.log(`Occupancy result stderr: ${occupancyResult.stderr}`);

      expect(occupancyResult.exitCode).toBe(0);
      expect(occupancyResult.stdout).toContain(occupancyChannel);
      expect(occupancyResult.stdout).toMatch(/Connections:\s*\d+/i);
      // The subscriber count might be 0 if the subscriber hasn't been registered yet
      expect(occupancyResult.stdout).toMatch(/Subscribers:\s*\d+/i);

      console.log(`Occupancy command completed successfully`);
    } finally {
      // Clean up - kill the subscriber process
      if (subscribeProcess) {
        await killProcess(subscribeProcess);
        // Wait for process to fully exit
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  });

  it("should subscribe to channel occupancy updates", async () => {
    setupTestFailureHandler("should subscribe to channel occupancy updates");

    // Skip if E2E tests should be skipped
    if (SHOULD_SKIP_E2E) {
      return;
    }

    let subscribeProcess: ChildProcess | null = null;
    let occupancyProcess: ChildProcess | null = null;

    try {
      // Start occupancy subscription
      console.log(
        `Starting occupancy subscription for channel ${occupancyChannel}`,
      );
      const occupancyInfo = await runLongRunningBackgroundProcess(
        `bin/run.js channels occupancy subscribe ${occupancyChannel} --duration 30`,
        outputPath,
        {
          readySignal: "Listening for occupancy events",
          timeoutMs: process.env.CI ? 20000 : 15000,
          retryCount: 2,
        },
      );
      occupancyProcess = occupancyInfo.process;

      console.log(
        `Occupancy subscription process started (PID: ${occupancyProcess.pid})`,
      );

      // Wait a bit for the subscription to be established
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Start a background subscriber process to trigger occupancy change
      console.log(
        `Starting background subscriber for channel ${occupancyChannel}`,
      );
      const subscribeInfo = await runLongRunningBackgroundProcess(
        `bin/run.js channels subscribe ${occupancyChannel} --duration 20`,
        await createTempOutputFile(),
        {
          readySignal: "Successfully attached to channel",
          timeoutMs: process.env.CI ? 20000 : 15000,
          retryCount: 2,
        },
      );
      subscribeProcess = subscribeInfo.process;

      console.log(
        `Background subscriber process started (PID: ${subscribeProcess.pid})`,
      );

      // Wait for occupancy update to be received
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Check output file for occupancy update
      const fs = await import("node:fs");
      const output = fs.readFileSync(outputPath, "utf8");
      expect(output).toContain("Occupancy Update");
      expect(output).toContain("metrics");

      console.log(`Occupancy subscription test completed successfully`);
    } finally {
      // Clean up - kill both processes
      if (subscribeProcess) {
        await killProcess(subscribeProcess);
      }
      if (occupancyProcess) {
        await killProcess(occupancyProcess);
      }
      // Wait for processes to fully exit
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  });
});
