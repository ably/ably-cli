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
  createAblyClient,
  createTempOutputFile,
  runLongRunningBackgroundProcess,
  readProcessOutput,
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

describe("Channel Annotations E2E Tests", () => {
  let annotationChannel: string;
  let messageSerial: string;

  beforeAll(async () => {
    if (SHOULD_SKIP_E2E) {
      return;
    }

    process.on("SIGINT", forceExit);

    try {
      // Create a unique channel and publish a message to get a serial
      annotationChannel = getUniqueChannelName("annotations");

      // Publish a message using the CLI to get a serial
      const publishResult = await runCommand(
        [
          "channels",
          "publish",
          annotationChannel,
          '{"data":"Annotation test message"}',
          "--json",
        ],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      if (publishResult.exitCode !== 0) {
        console.warn("Warning: Failed to publish setup message");
        return;
      }

      // Wait for message to be available in history
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Get the message serial from history
      const client = createAblyClient();
      const channel = client.channels.get(annotationChannel);
      const history = await channel.history();
      if (history.items.length > 0) {
        messageSerial = history.items[0].serial || "";
      }
    } catch (error) {
      console.warn(
        "Warning: Setup failed, tests may not function correctly:",
        error,
      );
    }
  });

  afterAll(() => {
    process.removeListener("SIGINT", forceExit);
  });

  beforeEach(() => {
    resetTestTracking();
    testOutputFiles.clear();
    testCommands.length = 0;
  });

  afterEach(async () => {
    await cleanupTrackedResources();
  });

  // E2E Test 1: Publish annotation
  it("should publish an annotation to a message", async () => {
    setupTestFailureHandler("should publish an annotation to a message");

    if (SHOULD_SKIP_E2E || !messageSerial) {
      return;
    }

    const publishResult = await runCommand(
      [
        "channels",
        "annotations",
        "publish",
        annotationChannel,
        messageSerial,
        "reactions:flag.v1",
        "--json",
      ],
      {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 30000,
      },
    );

    expect(publishResult.exitCode).toBe(0);

    if (!publishResult.stdout || publishResult.stdout.trim() === "") {
      throw new Error(
        `Publish annotation command returned empty output. Exit code: ${publishResult.exitCode}, Stderr: ${publishResult.stderr}`,
      );
    }

    let result;
    try {
      result = JSON.parse(publishResult.stdout);
    } catch (parseError) {
      throw new Error(
        `Failed to parse JSON output. Parse error: ${parseError}. Stdout: ${publishResult.stdout}`,
      );
    }

    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("channel", annotationChannel);
    expect(result).toHaveProperty("messageSerial", messageSerial);
    expect(result).toHaveProperty("annotationType", "reactions:flag.v1");
  });

  // E2E Test 2: Get annotations
  it("should get annotations for a message", async () => {
    setupTestFailureHandler("should get annotations for a message");

    if (SHOULD_SKIP_E2E || !messageSerial) {
      return;
    }

    // Wait a bit for the annotation from the previous test to be available
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const getResult = await runCommand(
      [
        "channels",
        "annotations",
        "get",
        annotationChannel,
        messageSerial,
        "--json",
      ],
      {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 30000,
      },
    );

    expect(getResult.exitCode).toBe(0);

    if (!getResult.stdout || getResult.stdout.trim() === "") {
      throw new Error(
        `Get annotations command returned empty output. Exit code: ${getResult.exitCode}, Stderr: ${getResult.stderr}`,
      );
    }

    let result;
    try {
      result = JSON.parse(getResult.stdout);
    } catch (parseError) {
      throw new Error(
        `Failed to parse JSON output. Parse error: ${parseError}. Stdout: ${getResult.stdout}`,
      );
    }

    // Result should be an array of annotations
    expect(Array.isArray(result)).toBe(true);
  });

  // E2E Test 3: Delete annotation
  it("should delete an annotation from a message", async () => {
    setupTestFailureHandler("should delete an annotation from a message");

    if (SHOULD_SKIP_E2E || !messageSerial) {
      return;
    }

    const deleteResult = await runCommand(
      [
        "channels",
        "annotations",
        "delete",
        annotationChannel,
        messageSerial,
        "reactions:flag.v1",
        "--json",
      ],
      {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 30000,
      },
    );

    expect(deleteResult.exitCode).toBe(0);

    if (!deleteResult.stdout || deleteResult.stdout.trim() === "") {
      throw new Error(
        `Delete annotation command returned empty output. Exit code: ${deleteResult.exitCode}, Stderr: ${deleteResult.stderr}`,
      );
    }

    let result;
    try {
      result = JSON.parse(deleteResult.stdout);
    } catch (parseError) {
      throw new Error(
        `Failed to parse JSON output. Parse error: ${parseError}. Stdout: ${deleteResult.stdout}`,
      );
    }

    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("channel", annotationChannel);
    expect(result).toHaveProperty("annotationType", "reactions:flag.v1");
  });

  // E2E Test 4: Subscribe to annotations
  it("should subscribe to annotation events on a channel", async () => {
    setupTestFailureHandler(
      "should subscribe to annotation events on a channel",
    );

    if (SHOULD_SKIP_E2E) {
      return;
    }

    const subscribeChannel = getUniqueChannelName("ann-sub");
    const outputPath = await createTempOutputFile();
    let subscribeProcessInfo: {
      process: ChildProcess;
      processId: string;
    } | null = null;

    try {
      const readySignal = "Subscribed to annotations";

      // Start the subscribe process, waiting for the ready signal
      subscribeProcessInfo = await runLongRunningBackgroundProcess(
        `bin/run.js channels annotations subscribe ${subscribeChannel} --duration 15`,
        outputPath,
        { readySignal, timeoutMs: 15000 },
      );

      // Wait for subscriber to be fully ready
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify the subscribe process started successfully
      const output = await readProcessOutput(outputPath);
      expect(output).toContain("Subscribed to annotations");
    } finally {
      if (subscribeProcessInfo) {
        await killProcess(subscribeProcessInfo.process);
      }
    }
  });
});
