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
  killProcess,
  forceExit,
  cleanupTrackedResources,
  testOutputFiles,
  testCommands,
  setupTestFailureHandler,
  resetTestTracking,
  createAblyRealtimeClient,
} from "../../../helpers/e2e-test-helper.js";
import { ChildProcess } from "node:child_process";
import * as Ably from "ably";

describe("Channel Annotations E2E Tests", () => {
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

  let testChannel: string;
  let outputPath: string;
  let subscribeProcessInfo: {
    process: ChildProcess;
    processId: string;
  } | null = null;
  let ablyClient: Ably.Realtime | null = null;
  let testMessageSerial: string;

  beforeEach(async () => {
    resetTestTracking();
    // Clear tracked commands and output files before each test
    testOutputFiles.clear();
    testCommands.length = 0;
    testChannel = getUniqueChannelName("annotations");
    outputPath = await createTempOutputFile();

    // Create Ably client and publish a message to get a serial
    if (!SHOULD_SKIP_E2E) {
      ablyClient = createAblyRealtimeClient();
      await new Promise<void>((resolve, reject) => {
        ablyClient!.connection.once("connected", () => resolve());
        ablyClient!.connection.once("failed", (err) => reject(err));
      });

      const channel = ablyClient.channels.get(testChannel);
      await channel.attach();

      // Publish a message and capture its serial
      await channel.publish("test-event", "test-data");
      // Get the serial from history
      const history = await channel.history({ limit: 1 });
      if (history.items.length > 0 && history.items[0].serial) {
        testMessageSerial = history.items[0].serial;
      } else {
        throw new Error("Failed to get message serial from history");
      }
    }
  });

  afterEach(async () => {
    // Kill specific process if necessary
    if (subscribeProcessInfo) {
      await killProcess(subscribeProcessInfo.process);
      subscribeProcessInfo = null;
    }
    // Close Ably client
    if (ablyClient) {
      ablyClient.close();
      ablyClient = null;
    }
    // Perform E2E cleanup
    await cleanupTrackedResources();
  });

  it("should publish an annotation to a message", async () => {
    setupTestFailureHandler("should publish an annotation to a message");

    if (SHOULD_SKIP_E2E) {
      return;
    }

    // Run the publish annotation command
    const { process: publishProcess, processId } =
      await runLongRunningBackgroundProcess(
        `bin/run.js channels annotations publish ${testChannel} ${testMessageSerial} reactions:like.total.v1`,
        outputPath,
        { readySignal: "Annotation published", timeoutMs: 15000 },
      );

    console.log(`[Test Annotations Publish] Process ${processId} completed.`);

    // Read output and verify
    const output = await readProcessOutput(outputPath);
    expect(output).toContain("Annotation published");

    await killProcess(publishProcess);
  });

  it("should get annotations for a message", async () => {
    setupTestFailureHandler("should get annotations for a message");

    if (SHOULD_SKIP_E2E) {
      return;
    }

    // First publish an annotation using SDK
    const channel = ablyClient!.channels.get(testChannel);
    await channel.annotations.publish(testMessageSerial, {
      type: "reactions:thumbsup.total.v1",
    });

    // Wait a bit for the annotation to be processed
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Run the get annotations command
    const { process: getProcess, processId } =
      await runLongRunningBackgroundProcess(
        `bin/run.js channels annotations get ${testChannel} ${testMessageSerial} --json`,
        outputPath,
        { timeoutMs: 15000 },
      );

    console.log(`[Test Annotations Get] Process ${processId} completed.`);

    // Wait for command to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Read output and verify
    const output = await readProcessOutput(outputPath);
    expect(output).toContain("annotations");

    await killProcess(getProcess);
  });

  it("should delete an annotation from a message", async () => {
    setupTestFailureHandler("should delete an annotation from a message");

    if (SHOULD_SKIP_E2E) {
      return;
    }

    const annotationType = "reactions:delete-test.total.v1";

    // First publish an annotation using SDK
    const channel = ablyClient!.channels.get(testChannel);
    await channel.annotations.publish(testMessageSerial, {
      type: annotationType,
    });

    // Wait a bit for the annotation to be processed
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Run the delete annotation command
    const { process: deleteProcess, processId } =
      await runLongRunningBackgroundProcess(
        `bin/run.js channels annotations delete ${testChannel} ${testMessageSerial} ${annotationType}`,
        outputPath,
        { readySignal: "Annotation deleted", timeoutMs: 15000 },
      );

    console.log(`[Test Annotations Delete] Process ${processId} completed.`);

    // Read output and verify
    const output = await readProcessOutput(outputPath);
    expect(output).toContain("Annotation deleted");

    await killProcess(deleteProcess);
  });

  it("should subscribe to annotation events on a channel", async () => {
    setupTestFailureHandler(
      "should subscribe to annotation events on a channel",
    );

    if (SHOULD_SKIP_E2E) {
      return;
    }

    const subscribeChannel = getUniqueChannelName("annotations-subscribe");
    const subscribeOutputPath = await createTempOutputFile();

    // Start subscribe process
    subscribeProcessInfo = await runLongRunningBackgroundProcess(
      `bin/run.js channels annotations subscribe ${subscribeChannel} --json`,
      subscribeOutputPath,
      { readySignal: "Listening for annotation events", timeoutMs: 15000 },
    );

    console.log(
      `[Test Annotations Subscribe] Background subscriber process ${subscribeProcessInfo.processId} ready.`,
    );

    // Publish a message and then an annotation
    const channel = ablyClient!.channels.get(subscribeChannel);
    await channel.attach();
    await channel.publish("test-event", "test-data");

    // Get the message serial
    const history = await channel.history({ limit: 1 });
    if (history.items.length === 0 || !history.items[0].serial) {
      throw new Error("Failed to get message serial");
    }
    const messageSerial = history.items[0].serial;

    // Publish an annotation using the SDK
    await channel.annotations.publish(messageSerial, {
      type: "reactions:heart.total.v1",
    });

    // Wait for the annotation event to be received
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Read output and verify
    const output = await readProcessOutput(subscribeOutputPath);
    expect(output).toContain("annotation.create");

    await killProcess(subscribeProcessInfo.process);
    subscribeProcessInfo = null;
  });
});
