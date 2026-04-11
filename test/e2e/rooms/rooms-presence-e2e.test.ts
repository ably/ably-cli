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
  E2E_API_KEY,
  SHOULD_SKIP_E2E,
  getUniqueChannelName,
  getUniqueClientId,
  forceExit,
  cleanupTrackedResources,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import {
  runCommand,
  startPresenceCommand,
  cleanupRunners,
} from "../../helpers/command-helpers.js";
import type { CliRunner } from "../../helpers/cli-runner.js";
import { parseNdjsonLines } from "../../helpers/ndjson.js";

describe.skipIf(SHOULD_SKIP_E2E)("Rooms Presence E2E Tests", () => {
  let testRoom: string;
  let clientId: string;

  beforeAll(() => {
    process.on("SIGINT", forceExit);
  });

  afterAll(() => {
    process.removeListener("SIGINT", forceExit);
  });

  beforeEach(() => {
    resetTestTracking();
    testRoom = getUniqueChannelName("room-pres");
    clientId = getUniqueClientId("pres-client");
  });

  afterEach(async () => {
    await cleanupTrackedResources();
  });

  describe("rooms presence enter", () => {
    it("should enter presence in a room and hold", async () => {
      setupTestFailureHandler("should enter presence in a room and hold");

      let runner: CliRunner | null = null;
      try {
        runner = await startPresenceCommand(
          [
            "rooms",
            "presence",
            "enter",
            testRoom,
            "--client-id",
            clientId,
            "--duration",
            "10",
          ],
          /Entered presence|Holding|entering/i,
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );

        // Verify the command started and entered presence
        const output = runner.combined();
        expect(output).toMatch(/presence|enter|hold/i);
      } finally {
        if (runner) {
          await cleanupRunners([runner]);
        }
      }
    }, 60000);

    it("should enter presence with JSON output", async () => {
      setupTestFailureHandler("should enter presence with JSON output");

      let runner: CliRunner | null = null;
      try {
        runner = await startPresenceCommand(
          [
            "rooms",
            "presence",
            "enter",
            testRoom,
            "--client-id",
            clientId,
            "--duration",
            "10",
            "--json",
          ],
          /presenceMessage|action.*enter|holding/i,
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );

        // Wait a moment for JSON output to settle
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const records = parseNdjsonLines(runner.stdout());
        // Verify we got some JSON output from the command
        expect(records.length).toBeGreaterThan(0);
      } finally {
        if (runner) {
          await cleanupRunners([runner]);
        }
      }
    }, 60000);
  });

  describe("rooms presence get", () => {
    it("should get presence members for a room", async () => {
      setupTestFailureHandler("should get presence members for a room");

      let enterRunner: CliRunner | null = null;
      try {
        // First enter presence so there's a member to find
        enterRunner = await startPresenceCommand(
          [
            "rooms",
            "presence",
            "enter",
            testRoom,
            "--client-id",
            clientId,
            "--duration",
            "15",
          ],
          /Entered presence|Holding|entering/i,
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );

        // Wait for presence to propagate
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Now query presence members
        const result = await runCommand(
          ["rooms", "presence", "get", testRoom, "--json"],
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );

        expect(result.exitCode).toBe(0);
        const records = parseNdjsonLines(result.stdout);
        const resultRecord = records.find((r) => r.type === "result");
        expect(resultRecord).toBeDefined();
        expect(resultRecord!.members).toBeDefined();
      } finally {
        if (enterRunner) {
          await cleanupRunners([enterRunner]);
        }
      }
    }, 60000);
  });
});
