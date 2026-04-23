import { describe, it, beforeEach, afterEach, expect } from "vitest";
import {
  E2E_API_KEY,
  SHOULD_SKIP_E2E,
  getUniqueChannelName,
  createAblyClient,
  cleanupTrackedResources,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import { runCommand } from "../../helpers/command-helpers.js";
import { parseNdjsonLines } from "../../helpers/ndjson.js";

describe.skipIf(SHOULD_SKIP_E2E)("Channel Batch Publish E2E Tests", () => {
  beforeEach(() => {
    resetTestTracking();
  });

  afterEach(async () => {
    await cleanupTrackedResources();
  });

  it(
    "should batch publish a message to multiple channels and verify via SDK history",
    { timeout: 60000 },
    async () => {
      setupTestFailureHandler(
        "should batch publish a message to multiple channels and verify via SDK history",
      );

      const ch1 = getUniqueChannelName("batch1");
      const ch2 = getUniqueChannelName("batch2");

      const result = await runCommand(
        [
          "channels",
          "batch-publish",
          "hello",
          "--channels",
          `${ch1},${ch2}`,
          "--json",
        ],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(result.exitCode).toBe(0);

      const records = parseNdjsonLines(result.stdout);
      const resultLine = records.find((r) => r.type === "result");
      expect(resultLine).toBeDefined();
      expect(resultLine!.success).toBe(true);

      // Verify via SDK that at least one channel received the message
      const client = createAblyClient();
      const channel = client.channels.get(ch1);

      // Retry until history is available (eventually consistent)
      let found = false;
      for (let i = 0; i < 10; i++) {
        const historyPage = await channel.history();
        const messages = historyPage.items;
        if (
          messages.some(
            (msg) =>
              msg.data === "hello" || JSON.stringify(msg.data) === '"hello"',
          )
        ) {
          found = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      expect(found).toBe(true);
    },
  );
});
