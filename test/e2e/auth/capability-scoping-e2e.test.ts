import { describe, it, beforeAll, afterAll, expect } from "vitest";
import {
  E2E_ACCESS_TOKEN,
  SHOULD_SKIP_CONTROL_E2E,
  setupTestFailureHandler,
} from "../../helpers/e2e-test-helper.js";
import { runCommand } from "../../helpers/command-helpers.js";
import { createTestApp } from "../../helpers/e2e-test-app.js";
import { parseAllJsonRecords } from "../../helpers/ndjson.js";
import stripAnsi from "strip-ansi";

describe.skipIf(SHOULD_SKIP_CONTROL_E2E)(
  "Auth Capability Scoping E2E Tests",
  () => {
    let testAppId: string;
    let teardownApp: (() => Promise<void>) | undefined;
    let publishOnlyKey: string;

    beforeAll(async () => {
      ({ appId: testAppId, teardown: teardownApp } = await createTestApp(
        "e2e-capability-scoping",
      ));

      // Create a key with publish-only capability scoped to "allowed-*"
      const createKey = await runCommand(
        [
          "auth",
          "keys",
          "create",
          "publish-only-allowed-prefix",
          "--app",
          testAppId,
          "--capabilities",
          '{"allowed-*":["publish"]}',
          "--json",
        ],
        {
          env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
        },
      );
      const keyResult = parseAllJsonRecords(stripAnsi(createKey.stdout)).find(
        (r) => r.type === "result",
      ) as Record<string, unknown>;
      const key = keyResult.key as Record<string, unknown>;
      publishOnlyKey = key.key as string;
      if (!publishOnlyKey) {
        throw new Error(
          `Failed to create scoped key: ${JSON.stringify(keyResult)}`,
        );
      }
    }, 30000);

    afterAll(async () => {
      await teardownApp?.();
    });

    it(
      "should allow publish on a channel matching the key's resource scope",
      { timeout: 30000 },
      async () => {
        setupTestFailureHandler(
          "should allow publish on a channel matching the key's resource scope",
        );

        const publishResult = await runCommand(
          [
            "channels",
            "publish",
            "allowed-scope-test",
            "hello-scoped",
            "--json",
          ],
          { env: { ABLY_API_KEY: publishOnlyKey } },
        );

        expect(publishResult.exitCode).toBe(0);
        const result = parseAllJsonRecords(
          stripAnsi(publishResult.stdout),
        ).find((r) => r.type === "result") as Record<string, unknown>;
        expect(result).toHaveProperty("success", true);
      },
    );

    it(
      "should reject publish on a channel outside the key's resource scope",
      { timeout: 30000 },
      async () => {
        setupTestFailureHandler(
          "should reject publish on a channel outside the key's resource scope",
        );

        const publishResult = await runCommand(
          [
            "channels",
            "publish",
            "forbidden-channel",
            "hello-scoped",
            "--json",
          ],
          { env: { ABLY_API_KEY: publishOnlyKey } },
        );

        // `channels publish` reports per-message errors inline, not via fail().
        const result = parseAllJsonRecords(
          stripAnsi(publishResult.stdout),
        ).find((r) => r.type === "result") as Record<string, unknown>;
        expect(result).toBeDefined();
        const publish = result.publish as {
          errors: number;
          published: number;
          allSucceeded: boolean;
          results: Array<{ success: boolean; error?: { message: string } }>;
        };
        expect(publish.errors).toBeGreaterThanOrEqual(1);
        expect(publish.published).toBe(0);
        expect(publish.allSucceeded).toBe(false);
        expect(publish.results[0].success).toBe(false);
        expect(publish.results[0].error?.message).toBeTruthy();
      },
    );

    it(
      "should reject history on a channel when the key lacks the history op",
      { timeout: 30000 },
      async () => {
        setupTestFailureHandler(
          "should reject history on a channel when the key lacks the history op",
        );

        const historyResult = await runCommand(
          ["channels", "history", "allowed-scope-test", "--json"],
          { env: { ABLY_API_KEY: publishOnlyKey } },
        );

        expect(historyResult.exitCode).not.toBe(0);
        const errorEvent = parseAllJsonRecords(
          stripAnsi(historyResult.stdout),
        ).find((r) => r.type === "error");
        expect(errorEvent).toBeDefined();
        expect(errorEvent).toHaveProperty("success", false);
      },
    );
  },
);
