import { describe, it, beforeEach, afterEach, expect } from "vitest";
import {
  E2E_API_KEY,
  SHOULD_SKIP_E2E,
  getUniqueChannelName,
  getUniqueClientId,
  cleanupTrackedResources,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import {
  runCommand,
  startSubscribeCommand,
  startPresenceCommand,
  waitForOutput,
  cleanupRunners,
} from "../../helpers/command-helpers.js";
import type { CliRunner } from "../../helpers/cli-runner.js";
import { parseNdjsonLines } from "../../helpers/ndjson.js";

describe.skipIf(SHOULD_SKIP_E2E)("Rooms Occupancy E2E Tests", () => {
  let testRoom: string;
  let clientId: string;

  beforeEach(() => {
    resetTestTracking();
    testRoom = getUniqueChannelName("room-occ");
    clientId = getUniqueClientId("occ-client");
  });

  afterEach(async () => {
    await cleanupTrackedResources();
  });

  describe("rooms occupancy get", () => {
    it("should get occupancy metrics for a room", async () => {
      setupTestFailureHandler("should get occupancy metrics for a room");

      const result = await runCommand(
        ["rooms", "occupancy", "get", testRoom, "--json"],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(result.exitCode).toBe(0);
      const records = parseNdjsonLines(result.stdout);
      const resultRecord = records.find((r) => r.type === "result");
      expect(resultRecord).toBeDefined();
      expect(resultRecord!.occupancy).toBeDefined();

      const occupancy = resultRecord!.occupancy as {
        room: string;
        metrics: { connections?: number; presenceMembers?: number };
      };
      expect(occupancy.room).toBe(testRoom);
      expect(occupancy.metrics).toBeDefined();
    }, 60000);
  });

  describe("rooms occupancy subscribe", () => {
    it("should receive occupancy updates when members join a room", async () => {
      setupTestFailureHandler(
        "should receive occupancy updates when members join a room",
      );

      let subscriber: CliRunner | null = null;
      let enterer: CliRunner | null = null;
      try {
        // Start occupancy subscriber
        subscriber = await startSubscribeCommand(
          [
            "rooms",
            "occupancy",
            "subscribe",
            testRoom,
            "--client-id",
            clientId,
            "--duration",
            "30",
          ],
          /Listening for occupancy|Subscribed to occupancy/i,
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );

        // Wait for subscription to be established
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Enter presence to trigger an occupancy change
        const enterClientId = getUniqueClientId("occ-enter");
        enterer = await startPresenceCommand(
          [
            "rooms",
            "presence",
            "enter",
            testRoom,
            "--client-id",
            enterClientId,
            "--duration",
            "15",
          ],
          /Entered presence|Holding|entering/i,
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );

        // Wait for the occupancy subscriber to receive an update
        await waitForOutput(
          subscriber,
          /connections|presenceMembers|Connections|Presence/i,
          15000,
        );

        // Verify subscriber is still running and received output
        expect(subscriber.combined()).toMatch(
          /connections|presenceMembers|Connections|Presence/i,
        );
      } finally {
        const runnersToCleanup = [subscriber, enterer].filter(
          Boolean,
        ) as CliRunner[];
        await cleanupRunners(runnersToCleanup);
      }
    }, 60000);
  });
});
