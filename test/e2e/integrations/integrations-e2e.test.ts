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
  E2E_ACCESS_TOKEN,
  SHOULD_SKIP_CONTROL_E2E,
  forceExit,
  cleanupTrackedResources,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import { runCommand } from "../../helpers/command-helpers.js";
import { parseNdjsonLines } from "../../helpers/ndjson.js";

describe.skipIf(SHOULD_SKIP_CONTROL_E2E)("Integrations E2E Tests", () => {
  let testAppId: string;

  beforeAll(async () => {
    process.on("SIGINT", forceExit);

    // Create a test app for integration operations
    const createResult = await runCommand(
      [
        "apps",
        "create",
        "--name",
        `e2e-integrations-test-${Date.now()}`,
        "--json",
      ],
      {
        env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
      },
    );

    if (createResult.exitCode !== 0) {
      throw new Error(`Failed to create test app: ${createResult.stderr}`);
    }
    const result = parseNdjsonLines(createResult.stdout).find(
      (r) => r.type === "result",
    ) as Record<string, unknown>;
    const app = result.app as Record<string, unknown>;
    testAppId = (app.id ?? app.appId) as string;
    if (!testAppId) {
      throw new Error(`No app ID found in result: ${JSON.stringify(result)}`);
    }
  });

  afterAll(async () => {
    if (testAppId) {
      try {
        await runCommand(["apps", "delete", testAppId, "--force"], {
          env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
        });
      } catch {
        // Ignore cleanup errors — the app may already be deleted
      }
    }
    process.removeListener("SIGINT", forceExit);
  });

  beforeEach(() => {
    resetTestTracking();
  });

  afterEach(async () => {
    await cleanupTrackedResources();
  });

  it("should list integrations for an app", { timeout: 15000 }, async () => {
    setupTestFailureHandler("should list integrations for an app");

    const listResult = await runCommand(
      ["integrations", "list", "--app", testAppId, "--json"],
      {
        env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
      },
    );

    expect(listResult.exitCode).toBe(0);
  });

  it(
    "should create, get, and delete an integration rule",
    { timeout: 30000 },
    async () => {
      setupTestFailureHandler(
        "should create, get, and delete an integration rule",
      );

      // Create an HTTP integration rule
      const createResult = await runCommand(
        [
          "integrations",
          "create",
          "--app",
          testAppId,
          "--rule-type",
          "http",
          "--source-type",
          "channel.message",
          "--target-url",
          "https://example.com/e2e-webhook-test",
          "--json",
        ],
        {
          env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
        },
      );

      expect(createResult.exitCode).toBe(0);

      // Extract the rule ID from the result
      const createLines = parseNdjsonLines(createResult.stdout);
      const createRecord = createLines.find((r) => r.type === "result");
      expect(createRecord).toBeDefined();

      const rule = (createRecord?.rule ?? createRecord?.integration) as
        | Record<string, unknown>
        | undefined;
      const ruleId = (rule?.id ?? rule?.ruleId ?? "") as string;
      expect(ruleId).toBeTruthy();

      // Get the integration rule by ID
      const getResult = await runCommand(
        ["integrations", "get", ruleId, "--app", testAppId, "--json"],
        {
          env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
        },
      );

      expect(getResult.exitCode).toBe(0);

      // Delete the integration rule
      const deleteResult = await runCommand(
        ["integrations", "delete", ruleId, "--app", testAppId, "--force"],
        {
          env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
        },
      );

      expect(deleteResult.exitCode).toBe(0);
    },
  );
});
