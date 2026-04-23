import { describe, it, beforeEach, afterEach, beforeAll, expect } from "vitest";
import * as Ably from "ably";
import {
  E2E_API_KEY,
  SHOULD_SKIP_E2E,
  getUniqueChannelName,
  createAblyClient,
  publishTestMessage,
  cleanupTrackedResources,
  testOutputFiles,
  testCommands,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import { runCommand } from "../../helpers/command-helpers.js";

// Helper to fetch channel history
async function getChannelHistory(channelName: string): Promise<Ably.Message[]> {
  const client = createAblyClient();
  const channel = client.channels.get(channelName);
  const historyPage = await channel.history();
  return historyPage.items;
}

// Helper to list all channels
async function listAllChannels(): Promise<string[]> {
  const client = createAblyClient();
  const result = await client.request("get", "/channels", 2, {}, null);
  return result.items.map(
    (channel: { channelId: string }) => channel.channelId,
  );
}

// Helper to retry for up to N seconds with a check function
async function retryUntilSuccess<T>(
  checkFn: () => Promise<T>,
  validator: (result: T) => boolean,
  maxWaitSeconds = 10,
  intervalMs = 500,
): Promise<T> {
  let totalWaitTime = 0;
  let lastResult: T;

  while (totalWaitTime < maxWaitSeconds * 1000) {
    lastResult = await checkFn();
    if (validator(lastResult)) {
      return lastResult;
    }

    // Wait before next check
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    totalWaitTime += intervalMs;
  }

  // Return last result even if not valid, for assertion failures
  return lastResult!;
}

describe("Channel E2E Tests", () => {
  // Skip all tests if API key not available
  // Set up vars for test data
  let historyChannel: string;
  let jsonHistoryChannel: string;
  let listChannel: string;

  beforeAll(async () => {
    if (SHOULD_SKIP_E2E) {
      return;
    }

    try {
      // Set up unique channel names for the tests
      historyChannel = getUniqueChannelName("history");
      jsonHistoryChannel = getUniqueChannelName("json-history");
      listChannel = getUniqueChannelName("list");

      // Set up history test data
      await publishTestMessage(historyChannel, { text: "E2E History Test" });
      await publishTestMessage(jsonHistoryChannel, {
        text: "JSON History Test",
      });
      await publishTestMessage(listChannel, { text: "List Test" });
    } catch (error) {
      console.warn(
        "Warning: Setup failed, tests may not function correctly:",
        error,
      );
      // Don't fail the entire test suite, let individual tests fail if needed
    }
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

  // Test channels list command with verification
  it("should list channels and verify test channel is included", async () => {
    setupTestFailureHandler(
      "should list channels and verify test channel is included",
    );

    // Skip if E2E tests should be skipped
    if (SHOULD_SKIP_E2E) {
      return;
    }

    // Run the CLI command
    const listResult = await runCommand(["channels", "list"], {
      env: { ABLY_API_KEY: E2E_API_KEY || "" },
      timeoutMs: 30000,
    });

    // Enhanced diagnostic error messages
    expect(listResult.exitCode).toBe(0);

    if (!listResult.stdout || listResult.stdout.trim() === "") {
      throw new Error(
        `Command returned empty output. Exit code: ${listResult.exitCode}, Stderr: ${listResult.stderr}, Stdout length: ${listResult.stdout.length}`,
      );
    }

    expect(listResult.stdout).toContain("Found");

    // Now verify with SDK in a separate step
    const allChannels = await retryUntilSuccess(
      listAllChannels,
      (channels) => channels.includes(listChannel),
      15,
    );

    const channelExists = allChannels.includes(listChannel);
    expect(channelExists).toBe(true);
  });

  // Test channels list with JSON output and verification
  it("should list channels in JSON format and verify test channel is included", async () => {
    setupTestFailureHandler(
      "should list channels in JSON format and verify test channel is included",
    );

    // Skip if E2E tests should be skipped
    if (SHOULD_SKIP_E2E) {
      return;
    }

    // First run the CLI command
    const listResult = await runCommand(["channels", "list", "--json"], {
      env: { ABLY_API_KEY: E2E_API_KEY || "" },
      timeoutMs: 30000,
    });

    // Enhanced diagnostic error messages
    expect(listResult.exitCode).toBe(0);

    if (!listResult.stdout || listResult.stdout.trim() === "") {
      throw new Error(
        `Command returned empty output. Exit code: ${listResult.exitCode}, Stderr: ${listResult.stderr}, Stdout length: ${listResult.stdout.length}`,
      );
    }

    let result;
    try {
      // JSON output may contain multiple NDJSON lines (result + completed status).
      // Parse the first non-empty line which contains the result data.
      const line = listResult.stdout.trim().split("\n").find(Boolean);
      result = JSON.parse(line);
    } catch (parseError) {
      throw new Error(
        `Failed to parse JSON output. Parse error: ${String(parseError)}. Exit code: ${listResult.exitCode}, Stderr: ${listResult.stderr}, Stdout: ${listResult.stdout}`,
        { cause: parseError },
      );
    }
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("channels");
    expect(Array.isArray(result.channels)).toBe(true);
    expect(result).toHaveProperty("timestamp");
    expect(typeof result.timestamp).toBe("string");

    // Now verify with SDK in a separate step
    const allChannels = await retryUntilSuccess(
      listAllChannels,
      (channels) => channels.includes(listChannel),
      15,
    );

    const foundChannel = allChannels.includes(listChannel);
    expect(foundChannel).toBe(true);
  });

  // Test publishing with verification
  it("should publish a message to a channel and verify it was published", async () => {
    setupTestFailureHandler(
      "should publish a message to a channel and verify it was published",
    );

    // Skip if E2E tests should be skipped
    if (SHOULD_SKIP_E2E) {
      return;
    }

    const messageData = { data: "E2E Test Message" };
    const uniqueChannel = getUniqueChannelName("cli");

    // First publish the message
    const publishResult = await runCommand(
      ["channels", "publish", uniqueChannel, JSON.stringify(messageData)],
      {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 30000,
      },
    );

    // Enhanced diagnostic error messages
    expect(publishResult.exitCode).toBe(0);

    if (!publishResult.stderr || publishResult.stderr.trim() === "") {
      throw new Error(
        `Publish command returned empty stderr. Exit code: ${publishResult.exitCode}, Stderr: ${publishResult.stderr}, Stdout length: ${publishResult.stdout.length}`,
      );
    }

    expect(publishResult.stderr).toContain(`Message published to channel`);
    expect(publishResult.stderr).toContain(uniqueChannel);

    // Add a delay to ensure message is stored and available in history
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Then check history
    const historyResult = await runCommand(
      ["channels", "history", uniqueChannel],
      {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 30000,
      },
    );

    // Enhanced diagnostic error messages for history check
    expect(historyResult.exitCode).toBe(0);

    if (!historyResult.stdout || historyResult.stdout.trim() === "") {
      throw new Error(
        `History command returned empty output. Exit code: ${historyResult.exitCode}, Stderr: ${historyResult.stderr}, Stdout length: ${historyResult.stdout.length}`,
      );
    }

    expect(historyResult.stdout).toContain("E2E Test Message");
  });

  // Test history with verification
  it("should retrieve message history and verify contents", async () => {
    setupTestFailureHandler(
      "should retrieve message history and verify contents",
    );

    // Skip if E2E tests should be skipped
    if (SHOULD_SKIP_E2E) {
      return;
    }

    // First run the CLI command
    const historyResult = await runCommand(
      ["channels", "history", historyChannel],
      {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 30000,
      },
    );

    // Enhanced diagnostic error messages
    expect(historyResult.exitCode).toBe(0);

    if (!historyResult.stdout || historyResult.stdout.trim() === "") {
      throw new Error(
        `History command returned empty output. Exit code: ${historyResult.exitCode}, Stderr: ${historyResult.stderr}, Stdout length: ${historyResult.stdout.length}`,
      );
    }

    expect(historyResult.stdout).toContain("E2E History Test");

    // Now verify with SDK in a separate step outside of Oclif's callback
    const history = await getChannelHistory(historyChannel);
    expect(history.length).toBeGreaterThanOrEqual(1);

    const testMsg = history.find(
      (msg) =>
        msg.data &&
        typeof msg.data === "object" &&
        msg.data.text === "E2E History Test",
    );

    expect(testMsg).toBeDefined();
  });

  // Test JSON history with verification
  it("should retrieve message history in JSON format and verify contents", async () => {
    setupTestFailureHandler(
      "should retrieve message history in JSON format and verify contents",
    );

    // Skip if E2E tests should be skipped
    if (SHOULD_SKIP_E2E) {
      return;
    }

    // First run the CLI command
    const historyResult = await runCommand(
      ["channels", "history", jsonHistoryChannel, "--json"],
      {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 30000,
      },
    );

    // Enhanced diagnostic error messages
    expect(historyResult.exitCode).toBe(0);

    if (!historyResult.stdout || historyResult.stdout.trim() === "") {
      throw new Error(
        `JSON History command returned empty output. Exit code: ${historyResult.exitCode}, Stderr: ${historyResult.stderr}, Stdout length: ${historyResult.stdout.length}`,
      );
    }

    let result;
    try {
      // The --json output is NDJSON: event lines, then a result line, then a completed status.
      // Find the line with type "result" which contains the history data.
      const lines = historyResult.stdout.trim().split("\n").filter(Boolean);
      const resultLine = lines
        .map((l) => JSON.parse(l))
        .find((obj) => obj.type === "result");
      result = resultLine;
    } catch (parseError) {
      throw new Error(
        `Failed to parse JSON history output. Parse error: ${String(parseError)}. Exit code: ${historyResult.exitCode}, Stderr: ${historyResult.stderr}, Stdout: ${historyResult.stdout}`,
        { cause: parseError },
      );
    }
    expect(result).toHaveProperty("messages");
    expect(Array.isArray(result.messages)).toBe(true);
    expect(result.messages.length).toBeGreaterThanOrEqual(1);

    const testMsg = result.messages.find(
      (msg: { data?: { text?: string } }) =>
        msg.data &&
        typeof msg.data === "object" &&
        msg.data.text === "JSON History Test",
    );
    expect(testMsg).toBeDefined();

    // Now verify with SDK in a separate step
    const history = await getChannelHistory(jsonHistoryChannel);
    expect(history.length).toBeGreaterThanOrEqual(1);

    const sdkMsg = history.find(
      (msg) =>
        msg.data &&
        typeof msg.data === "object" &&
        msg.data.text === "JSON History Test",
    );

    expect(sdkMsg).toBeDefined();
  });

  // Test batch publish with verification
  it("should batch publish messages and verify they were published", async () => {
    setupTestFailureHandler(
      "should batch publish messages and verify they were published",
    );

    // Skip if E2E tests should be skipped
    if (SHOULD_SKIP_E2E) {
      return;
    }

    const messageData = { data: "Batch Message 1" };
    const batchChannel = getUniqueChannelName("batch");

    // First batch publish the message
    const batchPublishResult = await runCommand(
      [
        "channels",
        "batch-publish",
        "--channels",
        batchChannel,
        JSON.stringify(messageData),
      ],
      {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 30000,
      },
    );

    // Enhanced diagnostic error messages
    expect(batchPublishResult.exitCode).toBe(0);

    if (!batchPublishResult.stderr || batchPublishResult.stderr.trim() === "") {
      throw new Error(
        `Batch publish command returned empty stderr. Exit code: ${batchPublishResult.exitCode}, Stderr: ${batchPublishResult.stderr}, Stdout length: ${batchPublishResult.stdout.length}`,
      );
    }

    expect(batchPublishResult.stderr).toContain("Batch publish successful");

    // Add a delay to ensure message is stored and available in history
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Then check history
    const batchHistoryResult = await runCommand(
      ["channels", "history", batchChannel],
      {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 30000,
      },
    );

    // Enhanced diagnostic error messages for batch history check
    expect(batchHistoryResult.exitCode).toBe(0);

    if (!batchHistoryResult.stdout || batchHistoryResult.stdout.trim() === "") {
      throw new Error(
        `Batch history command returned empty output. Exit code: ${batchHistoryResult.exitCode}, Stderr: ${batchHistoryResult.stderr}, Stdout length: ${batchHistoryResult.stdout.length}`,
      );
    }

    expect(batchHistoryResult.stdout).toContain("Batch Message 1");
  });

  // Test publishing multiple messages with count and verification
  it("should publish multiple messages with count parameter and verify they were published", async () => {
    setupTestFailureHandler(
      "should publish multiple messages with count parameter and verify they were published",
    );

    // Skip if E2E tests should be skipped
    if (SHOULD_SKIP_E2E) {
      return;
    }

    const expectedMessages = [
      "Message number 1",
      "Message number 2",
      "Message number 3",
    ];
    const countChannel = getUniqueChannelName("count");

    // First publish multiple messages
    const countPublishResult = await runCommand(
      [
        "channels",
        "publish",
        countChannel,
        "Message number {{.Count}}",
        "--count",
        "3",
      ],
      {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 30000,
      },
    );

    // Enhanced diagnostic error messages
    expect(countPublishResult.exitCode).toBe(0);

    if (!countPublishResult.stderr || countPublishResult.stderr.trim() === "") {
      throw new Error(
        `Count publish command returned empty stderr. Exit code: ${countPublishResult.exitCode}, Stderr: ${countPublishResult.stderr}, Stdout length: ${countPublishResult.stdout.length}`,
      );
    }

    expect(countPublishResult.stderr).toContain(
      "Message 1 published to channel",
    );
    expect(countPublishResult.stderr).toContain(
      "Message 2 published to channel",
    );
    expect(countPublishResult.stderr).toContain(
      "Message 3 published to channel",
    );
    expect(countPublishResult.stderr).toContain(
      "3/3 messages published to channel",
    );
    expect(countPublishResult.stderr).toContain(countChannel);

    // Add a delay to ensure messages are stored and available in history
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Then check history
    const countHistoryResult = await runCommand(
      ["channels", "history", countChannel],
      {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 30000,
      },
    );

    // Enhanced diagnostic error messages for count history check
    expect(countHistoryResult.exitCode).toBe(0);

    if (!countHistoryResult.stdout || countHistoryResult.stdout.trim() === "") {
      throw new Error(
        `Count history command returned empty output. Exit code: ${countHistoryResult.exitCode}, Stderr: ${countHistoryResult.stderr}, Stdout length: ${countHistoryResult.stdout.length}`,
      );
    }

    for (const expectedMsg of expectedMessages) {
      expect(countHistoryResult.stdout).toContain(expectedMsg);
    }
  });
});
