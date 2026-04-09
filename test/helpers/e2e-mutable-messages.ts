import { randomUUID } from "node:crypto";
import { runCommand } from "./command-helpers.js";
import { parseNdjsonLines } from "./ndjson.js";
import { E2E_API_KEY, E2E_ACCESS_TOKEN } from "./e2e-test-helper.js";
export { SHOULD_SKIP_CONTROL_E2E as SHOULD_SKIP_MUTABLE_TESTS } from "./e2e-test-helper.js";

/** Namespace prefix for mutable message test channels. */
export const MUTABLE_NAMESPACE = "e2e-mutable";

/** Track whether the rule was created so teardown knows whether to clean up. */
let ruleCreated = false;

function getAppId(): string {
  if (!E2E_API_KEY) throw new Error("E2E_API_KEY is not set");
  return E2E_API_KEY.split(".")[0] || "";
}

/**
 * Create a channel rule (namespace) with mutableMessages enabled.
 * Call in beforeAll. Handles "already exists" gracefully.
 */
export async function setupMutableMessagesRule(): Promise<void> {
  const appId = getAppId();

  const result = await runCommand(
    [
      "apps",
      "rules",
      "create",
      "--name",
      MUTABLE_NAMESPACE,
      "--mutable-messages",
      "--app",
      appId,
      "--json",
    ],
    {
      env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
      timeoutMs: 30000,
    },
  );

  if (result.exitCode === 0) {
    ruleCreated = true;
  } else {
    // Rule may already exist from a previous run — try to verify
    const listResult = await runCommand(
      ["apps", "rules", "list", "--app", appId, "--json"],
      {
        env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
        timeoutMs: 30000,
      },
    );

    const records = parseNdjsonLines(listResult.stdout);
    const resultRecord = records.find((r) => r.type === "result");
    const rules = (resultRecord?.rules ?? []) as Array<{
      id?: string;
      mutableMessages?: boolean;
    }>;
    const existing = rules.find(
      (r) => r.id === MUTABLE_NAMESPACE && r.mutableMessages === true,
    );

    if (existing) {
      ruleCreated = true;
    } else {
      throw new Error(
        `Failed to create mutable messages rule: exitCode=${result.exitCode}, stderr=${result.stderr}`,
      );
    }
  }

  // Brief delay for rule propagation
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

/**
 * Delete the channel rule created by setupMutableMessagesRule().
 * Call in afterAll. Ignores "not found" errors.
 */
export async function teardownMutableMessagesRule(): Promise<void> {
  if (!ruleCreated) return;

  const appId = getAppId();

  await runCommand(
    [
      "apps",
      "rules",
      "delete",
      MUTABLE_NAMESPACE,
      "--app",
      appId,
      "--force",
      "--json",
    ],
    {
      env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
      timeoutMs: 30000,
    },
  );

  ruleCreated = false;
}

/**
 * Generate a channel name under the mutable namespace.
 * Format: "e2e-mutable:<suffix>-<uuid>" — matches the namespace rule.
 */
export function getMutableChannelName(suffix: string): string {
  return `${MUTABLE_NAMESPACE}:${suffix}-${randomUUID().slice(0, 8)}`;
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
