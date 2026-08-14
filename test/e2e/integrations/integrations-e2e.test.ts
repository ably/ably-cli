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

      // Get the integration rule by ID. The "--" separator is required
      // because rule IDs can start with "-" (e.g. "-MYkHg"), which oclif
      // would otherwise misparse as an unknown flag.
      const getResult = await runCommand(
        ["integrations", "get", "--app", testAppId, "--json", "--", ruleId],
        {
          env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
        },
      );

      expect(getResult.exitCode).toBe(0);

      // Delete the integration rule
      const deleteResult = await runCommand(
        ["integrations", "delete", "--app", testAppId, "--force", "--", ruleId],
        {
          env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
        },
      );

      expect(deleteResult.exitCode).toBe(0);
    },
  );

  it(
    "should create, get, list, and delete a chat-room-sourced integration rule",
    { timeout: 30000 },
    async () => {
      setupTestFailureHandler(
        "should create, get, list, and delete a chat-room-sourced integration rule",
      );

      // Create a rule sourced from a chat room rather than a channel. Note
      // this must use "http/before-publish", not "http" — the plain "http"
      // rule schema rejects chatRoomFilter/chat.message sources entirely.
      const createResult = await runCommand(
        [
          "integrations",
          "create",
          "--app",
          testAppId,
          "--rule-type",
          "http/before-publish",
          "--source-type",
          "chat.message",
          "--chat-room-filter",
          "room:.*",
          "--target-url",
          "https://example.com/e2e-chat-room-webhook-test",
          "--json",
        ],
        {
          env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
        },
      );

      expect(createResult.exitCode).toBe(0);

      const createLines = parseNdjsonLines(createResult.stdout);
      const createRecord = createLines.find((r) => r.type === "result");
      expect(createRecord).toBeDefined();

      const createdRule = (createRecord?.rule ?? createRecord?.integration) as
        | Record<string, unknown>
        | undefined;
      const ruleId = (createdRule?.id ?? createdRule?.ruleId ?? "") as string;
      expect(ruleId).toBeTruthy();
      expect(createdRule).toHaveProperty("chatRoomFilter", "room:.*");

      // Get the rule and confirm chatRoomFilter round-trips. The "--"
      // separator is required because rule IDs can start with "-", which
      // oclif would otherwise misparse as an unknown flag.
      const getResult = await runCommand(
        ["integrations", "get", "--app", testAppId, "--json", "--", ruleId],
        {
          env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
        },
      );

      expect(getResult.exitCode).toBe(0);

      const getLines = parseNdjsonLines(getResult.stdout);
      const getRecord = getLines.find((r) => r.type === "result");
      expect(getRecord).toBeDefined();

      const fetchedRule = getRecord?.rule as Record<string, unknown>;
      expect(fetchedRule).toHaveProperty("chatRoomFilter", "room:.*");
      expect((fetchedRule.source as Record<string, unknown>).type).toBe(
        "chat.message",
      );

      // List rules and confirm the chat-room rule appears with its filter
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

      const listedRule = (
        listRecord!.integrations as Record<string, unknown>[]
      ).find((rule) => rule.id === ruleId);
      expect(listedRule).toBeDefined();
      expect(listedRule).toHaveProperty("chatRoomFilter", "room:.*");

      // Delete the integration rule
      const deleteResult = await runCommand(
        ["integrations", "delete", "--app", testAppId, "--force", "--", ruleId],
        {
          env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
        },
      );

      expect(deleteResult.exitCode).toBe(0);
    },
  );

  interface ChatRuleScenario {
    createArgs: string[];
    expectBeforePublishConfig: boolean;
    expectedInvocationMode: "AFTER_PUBLISH" | "BEFORE_PUBLISH";
    ruleType: string;
    verifyTarget: (target: Record<string, unknown>) => void;
  }

  // A generic Azure hostname known to resolve via DNS, used to satisfy the
  // control API's live endpoint-reachability check for azure/text-moderation.
  const AZURE_TEST_ENDPOINT = "https://test.cognitiveservices.azure.com";

  // Every chat-sourced rule type the control API supports, exercised as a
  // full create/get/delete lifecycle against the real API. These are
  // structurally distinct from the classic Reactor rule types (http, amqp,
  // etc.) — they use invocationMode/beforePublishConfig instead of
  // requestMode, and each has its own vendor-specific target shape.
  const CHAT_RULE_SCENARIOS: ChatRuleScenario[] = [
    {
      createArgs: [
        "--chat-room-filter",
        "room:.*",
        "--target-url",
        "https://example.com/e2e-before-publish-webhook-test",
      ],
      expectBeforePublishConfig: true,
      expectedInvocationMode: "BEFORE_PUBLISH",
      ruleType: "http/before-publish",
      verifyTarget: (target) => {
        expect(target.url).toBe(
          "https://example.com/e2e-before-publish-webhook-test",
        );
      },
    },
    {
      createArgs: [
        "--target-api-key",
        "e2e-hive-key",
        "--threshold",
        "bullying=2",
      ],
      expectBeforePublishConfig: true,
      expectedInvocationMode: "BEFORE_PUBLISH",
      ruleType: "hive/text-model-only",
      verifyTarget: (target) => {
        expect(target.apiKey).toBe("e2e-hive-key");
        expect(target.thresholds).toMatchObject({ bullying: 2 });
      },
    },
    {
      createArgs: ["--target-api-key", "e2e-dashboard-key"],
      expectBeforePublishConfig: false,
      expectedInvocationMode: "AFTER_PUBLISH",
      ruleType: "hive/dashboard",
      verifyTarget: (target) => {
        expect(target.apiKey).toBe("e2e-dashboard-key");
      },
    },
    {
      createArgs: [
        "--target-api-key",
        "e2e-bodyguard-key",
        "--target-channel-id",
        "e2e-channel-id",
      ],
      expectBeforePublishConfig: true,
      expectedInvocationMode: "BEFORE_PUBLISH",
      ruleType: "bodyguard/text-moderation",
      verifyTarget: (target) => {
        expect(target.apiKey).toBe("e2e-bodyguard-key");
        expect(target.channelId).toBe("e2e-channel-id");
      },
    },
    {
      createArgs: [
        "--target-api-key",
        "e2e-tisane-key",
        "--threshold",
        "allegation=1",
        "--threshold",
        "profanity=1",
        "--default-language",
        "*",
      ],
      expectBeforePublishConfig: true,
      expectedInvocationMode: "BEFORE_PUBLISH",
      ruleType: "tisane/text-moderation",
      verifyTarget: (target) => {
        expect(target.apiKey).toBe("e2e-tisane-key");
        expect(target.thresholds).toMatchObject({
          allegation: 1,
          profanity: 1,
        });
        expect(target.defaultLanguage).toBe("*");
      },
    },
    {
      // The control API resolves the endpoint's DNS at creation time and
      // 422s on ENOTFOUND, so this must be a real, resolvable hostname
      // rather than an arbitrary placeholder domain.
      createArgs: [
        "--target-api-key",
        "e2e-azure-key",
        "--target-endpoint",
        AZURE_TEST_ENDPOINT,
        "--threshold",
        "Hate=2",
      ],
      expectBeforePublishConfig: true,
      expectedInvocationMode: "BEFORE_PUBLISH",
      ruleType: "azure/text-moderation",
      verifyTarget: (target) => {
        expect(target.apiKey).toBe("e2e-azure-key");
        expect(target.endpoint).toBe(AZURE_TEST_ENDPOINT);
        expect(target.thresholds).toMatchObject({ Hate: 2 });
      },
    },
    {
      createArgs: [
        "--target-function-name",
        "e2e-test-function",
        "--target-region",
        "eu-west-1",
        "--target-access-key-id",
        "AKIAE2ETEST",
        "--target-secret-access-key",
        "e2e-secret",
      ],
      expectBeforePublishConfig: true,
      expectedInvocationMode: "BEFORE_PUBLISH",
      ruleType: "aws/lambda/before-publish",
      verifyTarget: (target) => {
        expect(target.functionName).toBe("e2e-test-function");
        expect(target.region).toBe("eu-west-1");
        const authentication = target.authentication as Record<string, unknown>;
        expect(authentication.authenticationMode).toBe("credentials");
        expect(authentication.accessKeyId).toBe("AKIAE2ETEST");
      },
    },
  ];

  describe.each(CHAT_RULE_SCENARIOS)(
    "chat rule type: $ruleType",
    (scenario) => {
      it(
        `should create, get, and delete a ${scenario.ruleType} rule`,
        { timeout: 30000 },
        async () => {
          setupTestFailureHandler(
            `should create, get, and delete a ${scenario.ruleType} rule`,
          );

          const createResult = await runCommand(
            [
              "integrations",
              "create",
              "--app",
              testAppId,
              "--rule-type",
              scenario.ruleType,
              "--source-type",
              "chat.message",
              ...scenario.createArgs,
              "--json",
            ],
            {
              env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
            },
          );

          expect(createResult.exitCode).toBe(0);

          const createLines = parseNdjsonLines(createResult.stdout);
          const createRecord = createLines.find((r) => r.type === "result");
          expect(createRecord).toBeDefined();

          const createdRule = (createRecord?.rule ??
            createRecord?.integration) as Record<string, unknown> | undefined;
          const ruleId = (createdRule?.id ??
            createdRule?.ruleId ??
            "") as string;
          expect(ruleId).toBeTruthy();

          expect(createdRule).toHaveProperty("ruleType", scenario.ruleType);
          expect(createdRule).toHaveProperty(
            "invocationMode",
            scenario.expectedInvocationMode,
          );
          expect(Boolean(createdRule?.beforePublishConfig)).toBe(
            scenario.expectBeforePublishConfig,
          );

          scenario.verifyTarget(createdRule?.target as Record<string, unknown>);

          // Get the rule and confirm it round-trips. The "--" separator is
          // required because rule IDs can start with "-", which oclif would
          // otherwise misparse as an unknown flag.
          const getResult = await runCommand(
            ["integrations", "get", "--app", testAppId, "--json", "--", ruleId],
            {
              env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
            },
          );

          expect(getResult.exitCode).toBe(0);

          const getLines = parseNdjsonLines(getResult.stdout);
          const getRecord = getLines.find((r) => r.type === "result");
          expect(getRecord).toBeDefined();

          const fetchedRule = getRecord?.rule as Record<string, unknown>;
          expect(fetchedRule).toHaveProperty("ruleType", scenario.ruleType);
          expect(fetchedRule).toHaveProperty(
            "invocationMode",
            scenario.expectedInvocationMode,
          );
          scenario.verifyTarget(fetchedRule.target as Record<string, unknown>);

          // Delete the integration rule
          const deleteResult = await runCommand(
            [
              "integrations",
              "delete",
              "--app",
              testAppId,
              "--force",
              "--",
              ruleId,
            ],
            {
              env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
            },
          );

          expect(deleteResult.exitCode).toBe(0);
        },
      );
    },
  );
});
