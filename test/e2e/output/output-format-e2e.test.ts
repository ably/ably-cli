import { describe, it, beforeAll, afterAll, expect } from "vitest";
import {
  E2E_API_KEY,
  E2E_ACCESS_TOKEN,
  SHOULD_SKIP_E2E,
  SHOULD_SKIP_CONTROL_E2E,
  forceExit,
  setupTestFailureHandler,
} from "../../helpers/e2e-test-helper.js";
import { runCommand } from "../../helpers/command-helpers.js";
import { parseAllJsonRecords } from "../../helpers/ndjson.js";
import stripAnsi from "strip-ansi";

function assertErrorEnvelope(
  stdout: string,
  ctx: string,
): Record<string, unknown> {
  const records = parseAllJsonRecords(stripAnsi(stdout));
  const errorRecord = records.find((r) => r.type === "error");
  expect(errorRecord, `[${ctx}] expected type:error record`).toBeDefined();
  expect(errorRecord).toHaveProperty("type", "error");
  expect(errorRecord).toHaveProperty("success", false);
  expect(errorRecord).toHaveProperty("command");
  expect(errorRecord).toHaveProperty("error");
  const err = (errorRecord as Record<string, unknown>).error as Record<
    string,
    unknown
  >;
  expect(err, `[${ctx}] error object must be present`).toBeDefined();
  expect(err).toHaveProperty("message");
  expect(typeof err.message).toBe("string");

  const completed = records.find(
    (r) => r.type === "status" && r.status === "completed",
  );
  expect(completed).toBeDefined();
  expect(completed).toHaveProperty("exitCode", 1);

  return err;
}

describe.skipIf(SHOULD_SKIP_E2E)("--pretty-json output shape", () => {
  beforeAll(() => {
    process.on("SIGINT", forceExit);
  });

  afterAll(() => {
    process.removeListener("SIGINT", forceExit);
  });

  it(
    "channels publish emits multi-line, indented, parseable JSON under --pretty-json",
    { timeout: 20000 },
    async () => {
      setupTestFailureHandler(
        "channels publish emits multi-line, indented, parseable JSON under --pretty-json",
      );

      const channel = `pretty-json-test-${Date.now()}`;
      const result = await runCommand(
        ["channels", "publish", channel, "hello-pretty", "--pretty-json"],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
        },
      );

      expect(result.exitCode).toBe(0);

      // CLI may emit ANSI color codes in CI — strip before shape assertions
      const clean = stripAnsi(result.stdout);

      // pretty-json should span multiple lines (not compact single-line NDJSON)
      const lines = clean.split("\n").filter((l) => l.length > 0);
      expect(lines.length).toBeGreaterThan(1);

      // pretty-json should contain indentation whitespace
      expect(clean).toMatch(/\n\s{2,}"/);

      // Every emitted JSON object must parse cleanly
      const parsed = parseAllJsonRecords(clean);
      expect(parsed.length).toBeGreaterThanOrEqual(2); // result + completed

      const resultRecord = parsed.find((r) => r.type === "result");
      const completedRecord = parsed.find(
        (r) => r.type === "status" && r.status === "completed",
      );

      expect(resultRecord).toBeDefined();
      expect(resultRecord).toHaveProperty("success", true);
      expect(resultRecord).toHaveProperty("command");
      expect(completedRecord).toBeDefined();
      expect(completedRecord).toHaveProperty("exitCode", 0);
    },
  );

  it(
    "channels history emits parseable pretty JSON matching the --json envelope shape",
    { timeout: 20000 },
    async () => {
      setupTestFailureHandler(
        "channels history emits parseable pretty JSON matching the --json envelope shape",
      );

      const channel = `pretty-json-history-${Date.now()}`;
      // Publish one message so history has something to return
      await runCommand(
        ["channels", "publish", channel, "msg-for-history", "--json"],
        { env: { ABLY_API_KEY: E2E_API_KEY || "" } },
      );
      await new Promise((r) => setTimeout(r, 1500));

      const [pretty, compact] = await Promise.all([
        runCommand(["channels", "history", channel, "--pretty-json"], {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
        }),
        runCommand(["channels", "history", channel, "--json"], {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
        }),
      ]);

      expect(pretty.exitCode).toBe(0);
      expect(compact.exitCode).toBe(0);

      const prettyClean = stripAnsi(pretty.stdout);
      const compactClean = stripAnsi(compact.stdout);

      // pretty is multi-line, compact is single-line per record
      expect(prettyClean.split("\n").length).toBeGreaterThan(
        compactClean.split("\n").length,
      );

      const prettyResult = parseAllJsonRecords(prettyClean).find(
        (r) => r.type === "result",
      ) as Record<string, unknown>;

      const compactResult = parseAllJsonRecords(compactClean).find(
        (r) => r.type === "result",
      ) as Record<string, unknown>;

      // Envelope fields should match between the two formats
      expect(prettyResult.type).toEqual(compactResult.type);
      expect(prettyResult.command).toEqual(compactResult.command);
      expect(prettyResult.success).toEqual(compactResult.success);
      expect(Array.isArray(prettyResult.messages)).toBe(true);
    },
  );
});

describe.skipIf(SHOULD_SKIP_E2E)("--json error envelope consistency", () => {
  beforeAll(() => {
    process.on("SIGINT", forceExit);
  });

  afterAll(() => {
    process.removeListener("SIGINT", forceExit);
  });

  // `channels publish` reports per-message errors inline; `channels history`
  // funnels through this.fail() and emits the error envelope.
  it(
    "channels history with an invalid API key produces the standard error envelope",
    { timeout: 15000 },
    async () => {
      setupTestFailureHandler(
        "channels history with an invalid API key produces the standard error envelope",
      );

      const result = await runCommand(
        ["channels", "history", "anything", "--json"],
        {
          env: { ABLY_API_KEY: "fake.app:deadbeefdeadbeefdeadbeefdeadbeef" },
        },
      );

      expect(result.exitCode).not.toBe(0);
      const err = assertErrorEnvelope(result.stdout, "invalid-api-key");
      // Should carry an Ably error code and HTTP status
      expect(err).toHaveProperty("code");
      expect(err).toHaveProperty("statusCode");
    },
  );

  it.skipIf(SHOULD_SKIP_CONTROL_E2E)(
    "auth keys get with a non-existent key produces the standard error envelope",
    { timeout: 15000 },
    async () => {
      setupTestFailureHandler(
        "auth keys get with a non-existent key produces the standard error envelope",
      );

      const result = await runCommand(
        ["auth", "keys", "get", "nonexistentapp.nonexistentkey", "--json"],
        {
          env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
        },
      );

      expect(result.exitCode).not.toBe(0);
      assertErrorEnvelope(result.stdout, "nonexistent-key");
    },
  );

  it.skipIf(SHOULD_SKIP_CONTROL_E2E)(
    "apps delete on a non-existent app produces the standard error envelope",
    { timeout: 15000 },
    async () => {
      setupTestFailureHandler(
        "apps delete on a non-existent app produces the standard error envelope",
      );

      const result = await runCommand(
        ["apps", "delete", "nonexistentapp000000", "--force", "--json"],
        {
          env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
        },
      );

      expect(result.exitCode).not.toBe(0);
      assertErrorEnvelope(result.stdout, "nonexistent-app");
    },
  );

  // Pins src/utils/errors.ts → envelope.error.hint wiring for Ably 40160.
  it.skipIf(SHOULD_SKIP_CONTROL_E2E)(
    "error envelope includes a friendly hint for known Ably error codes",
    { timeout: 45000 },
    async () => {
      setupTestFailureHandler(
        "error envelope includes a friendly hint for known Ably error codes",
      );

      // Create throwaway app
      const appCreate = await runCommand(
        ["apps", "create", `e2e-hint-test-${Date.now()}`, "--json"],
        {
          env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
        },
      );
      const appRecord = parseAllJsonRecords(stripAnsi(appCreate.stdout)).find(
        (r) => r.type === "result",
      ) as Record<string, unknown>;
      const appId = (appRecord.app as Record<string, unknown>).id as string;
      expect(appId).toBeTruthy();

      try {
        // Create a key scoped to publish on "allowed-*" only
        const keyCreate = await runCommand(
          [
            "auth",
            "keys",
            "create",
            "hint-scoped-key",
            "--app",
            appId,
            "--capabilities",
            '{"allowed-*":["publish"]}',
            "--json",
          ],
          {
            env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
          },
        );
        const keyRecord = parseAllJsonRecords(stripAnsi(keyCreate.stdout)).find(
          (r) => r.type === "result",
        ) as Record<string, unknown>;
        const scopedKey = (keyRecord.key as Record<string, unknown>)
          .key as string;
        expect(scopedKey).toBeTruthy();

        // Key lacks `history` op → Ably 40160, emitted via this.fail().
        const history = await runCommand(
          ["channels", "history", "allowed-history-test", "--json"],
          { env: { ABLY_API_KEY: scopedKey } },
        );

        expect(history.exitCode).not.toBe(0);
        const err = assertErrorEnvelope(history.stdout, "40160-with-hint");

        expect(err).toHaveProperty("code", 40160);
        expect(err).toHaveProperty("hint");
        expect(typeof err.hint).toBe("string");
        // The 40160 hint directs users at the auth keys list workflow
        expect(err.hint as string).toMatch(/ably auth keys list/);
      } finally {
        await runCommand(["apps", "delete", appId, "--force"], {
          env: { ABLY_ACCESS_TOKEN: E2E_ACCESS_TOKEN || "" },
        });
      }
    },
  );
});
