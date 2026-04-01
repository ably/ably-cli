import { runCommand } from "./command-helpers.js";
import { parseNdjsonLines } from "./ndjson.js";
import { E2E_API_KEY, getUniqueChannelName } from "./e2e-test-helper.js";

/**
 * Probe whether the E2E test app supports mutable messages by attempting
 * a message update on a temporary channel. Returns false if error 93002
 * (mutableMessages not enabled) is returned.
 */
export async function checkMutableMessagesSupport(): Promise<boolean> {
  const probeChannel = getUniqueChannelName("mutable-probe");

  // Publish a message first
  const pubResult = await runCommand(
    ["channels", "publish", probeChannel, "probe", "--json"],
    {
      env: { ABLY_API_KEY: E2E_API_KEY || "" },
      timeoutMs: 15000,
    },
  );
  if (pubResult.exitCode !== 0) return false;

  // Get the serial from history
  for (let attempt = 0; attempt < 5; attempt++) {
    const histResult = await runCommand(
      ["channels", "history", probeChannel, "--json", "--limit", "1"],
      {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 15000,
      },
    );
    if (histResult.exitCode !== 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }

    const records = parseNdjsonLines(histResult.stdout);
    const result = records.find((r) => r.type === "result");
    const messages = result?.messages as Array<{ serial?: string }> | undefined;
    if (!messages?.[0]?.serial) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }

    // Try to update the message — if it fails with 93002, mutable messages isn't enabled
    const updateResult = await runCommand(
      [
        "channels",
        "update",
        probeChannel,
        messages[0].serial,
        "updated-probe",
        "--json",
      ],
      {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 15000,
      },
    );

    if (updateResult.exitCode === 0) return true;

    // Check for error code 93002
    const errorRecords = parseNdjsonLines(updateResult.stdout);
    const errorRecord = errorRecords.find((r) => r.type === "error");
    const error = errorRecord?.error as { code?: number } | undefined;
    if (error?.code === 93002) {
      return false;
    }

    // Some other error — assume not supported
    return false;
  }

  return false;
}

/**
 * Publish a message via CLI with --json, then get the serial from history --json.
 * Uses retry logic to handle eventual consistency.
 */
export async function publishAndGetSerial(
  channelName: string,
  messageText: string,
): Promise<string> {
  const publishResult = await runCommand(
    ["channels", "publish", channelName, messageText, "--json"],
    {
      env: { ABLY_API_KEY: E2E_API_KEY || "" },
      timeoutMs: 30000,
    },
  );
  if (publishResult.exitCode !== 0) {
    throw new Error(
      `Publish failed: exitCode=${publishResult.exitCode}, stderr=${publishResult.stderr}`,
    );
  }

  // Retry history until the message is available (eventually consistent)
  for (let attempt = 0; attempt < 10; attempt++) {
    const historyResult = await runCommand(
      ["channels", "history", channelName, "--json", "--limit", "1"],
      {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 30000,
      },
    );
    if (historyResult.exitCode !== 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }

    const records = parseNdjsonLines(historyResult.stdout);
    const result = records.find((r) => r.type === "result");
    const messages = result?.messages as Array<{ serial?: string }> | undefined;
    if (messages && messages.length > 0 && messages[0].serial) {
      return messages[0].serial;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(
    `No message serial found in history after retries for channel: ${channelName}`,
  );
}
