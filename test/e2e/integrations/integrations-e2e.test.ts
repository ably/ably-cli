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
  cleanupTrackedResources,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import { runCommand } from "../../helpers/command-helpers.js";
import { parseNdjsonLines } from "../../helpers/ndjson.js";
import { createTestApp } from "../../helpers/e2e-test-app.js";

describe.skipIf(SHOULD_SKIP_CONTROL_E2E)("Integrations E2E Tests", () => {
  let testAppId: string;
  let teardown: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    ({ appId: testAppId, teardown } = await createTestApp(
      "e2e-integrations-test",
    ));
  });

  afterAll(async () => {
    await teardown?.();
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

    const listRecords = parseNdjsonLines(listResult.stdout);
    const listRecord = listRecords.find((r) => r.type === "result");
    expect(listRecord).toBeDefined();
    expect(listRecord!.success).toBe(true);
    expect(Array.isArray(listRecord!.integrations)).toBe(true);
    expect(listRecord).toHaveProperty("appId");
    expect(listRecord).toHaveProperty("total");
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
