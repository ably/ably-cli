import { runCommand } from "./command-helpers.js";
import { E2E_ACCESS_TOKEN } from "./e2e-test-helper.js";
import { parseNdjsonLines } from "./ndjson.js";

export interface TestAppHandle {
  appId: string;
  teardown: () => Promise<void>;
}

/**
 * Create a disposable test app via `ably apps create` for E2E tests and return
 * the app ID plus a `teardown` function that deletes the app.
 *
 * Typical use:
 * ```ts
 * let handle: TestAppHandle;
 * beforeAll(async () => { handle = await createTestApp("e2e-mytest"); });
 * afterAll(async () => { await handle.teardown(); });
 * ```
 */
export async function createTestApp(
  namePrefix: string,
): Promise<TestAppHandle> {
  const createResult = await runCommand(
    ["apps", "create", `${namePrefix}-${Date.now()}`, "--json"],
    { env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" } },
  );
  if (createResult.exitCode !== 0) {
    throw new Error(`Failed to create test app: ${createResult.stderr}`);
  }
  const result = parseNdjsonLines(createResult.stdout).find(
    (r) => r.type === "result",
  );
  if (!result) {
    throw new Error(
      `No result record in apps create output: ${createResult.stdout}`,
    );
  }
  const app = result.app as Record<string, unknown> | undefined;
  const appId = (app?.id ?? app?.appId) as string | undefined;
  if (!appId) {
    throw new Error(`No app ID found in result: ${JSON.stringify(result)}`);
  }

  return {
    appId,
    teardown: async () => {
      try {
        await runCommand(["apps", "delete", appId, "--force"], {
          env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
        });
      } catch {
        // Ignore cleanup errors — app may already be deleted
      }
    },
  };
}
