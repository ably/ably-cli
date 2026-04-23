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
  startPresenceCommand,
  startSubscribeCommand,
  cleanupRunners,
} from "../../helpers/command-helpers.js";
import type { CliRunner } from "../../helpers/cli-runner.js";
import { parseNdjsonLines } from "../../helpers/ndjson.js";

describe.skipIf(SHOULD_SKIP_E2E)(
  "Spaces Locations, Cursors, and Locks E2E Tests",
  () => {
    let spaceName: string;
    let clientId: string;

    beforeEach(() => {
      resetTestTracking();
      spaceName = getUniqueChannelName("space-loc");
      clientId = getUniqueClientId("loc-client");
    });

    afterEach(async () => {
      await cleanupTrackedResources();
    });

    describe("spaces locations", () => {
      it(
        "should set location and get locations",
        { timeout: 60000 },
        async () => {
          setupTestFailureHandler("should set location and get locations");

          let locationRunner: CliRunner | null = null;

          try {
            // Set location (long-running hold command)
            locationRunner = await startPresenceCommand(
              [
                "spaces",
                "locations",
                "set",
                spaceName,
                '{"slide":1}',
                "--client-id",
                clientId,
                "--duration",
                "15",
              ],
              /Holding|Set location|location/i,
              {
                env: { ABLY_API_KEY: E2E_API_KEY || "" },
                timeoutMs: 30000,
              },
            );

            // Wait a moment for the location to propagate
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Get locations
            const getResult = await runCommand(
              ["spaces", "locations", "get", spaceName, "--json"],
              {
                env: { ABLY_API_KEY: E2E_API_KEY || "" },
                timeoutMs: 15000,
              },
            );

            expect(getResult.exitCode).toBe(0);

            const records = parseNdjsonLines(getResult.stdout);
            const resultRecord = records.find((r) => r.type === "result");
            expect(resultRecord).toBeDefined();
            expect(resultRecord!.success).toBe(true);
            const locations = resultRecord!.locations as Array<{
              connectionId: string;
              location: unknown;
            }>;
            expect(locations).toBeDefined();
            expect(locations.length).toBeGreaterThan(0);
            expect(locations[0]).toHaveProperty("connectionId");
            expect(locations[0]).toHaveProperty("location");
          } finally {
            if (locationRunner) {
              await cleanupRunners([locationRunner]);
            }
          }
        },
      );
    });

    describe("spaces cursors", () => {
      it("should set cursor and get cursors", { timeout: 60000 }, async () => {
        setupTestFailureHandler("should set cursor and get cursors");

        let subscriberRunner: CliRunner | null = null;
        let cursorRunner: CliRunner | null = null;

        try {
          // The Spaces SDK only publishes cursor data when 2+ members are on the
          // ::$cursors channel (CursorBatching.shouldSend optimization). Start a
          // subscriber first so cursor set actually publishes to channel history.
          subscriberRunner = await startSubscribeCommand(
            [
              "spaces",
              "cursors",
              "subscribe",
              spaceName,
              "--client-id",
              `${clientId}-subscriber`,
              "--duration",
              "30",
            ],
            /Listening|listening/i,
            {
              env: { ABLY_API_KEY: E2E_API_KEY || "" },
              timeoutMs: 30000,
            },
          );

          // Wait for subscriber's presence to propagate on the cursors channel
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Set cursor with --simulate for continuous publishes (resilient against
          // brief race between presence callback and first cursor.set call)
          cursorRunner = await startPresenceCommand(
            [
              "spaces",
              "cursors",
              "set",
              spaceName,
              "--simulate",
              "--x",
              "10",
              "--y",
              "20",
              "--client-id",
              clientId,
              "--duration",
              "15",
            ],
            /Holding|Simulating|cursor/i,
            {
              env: { ABLY_API_KEY: E2E_API_KEY || "" },
              timeoutMs: 30000,
            },
          );

          // Wait for simulated cursor data to be published to channel history
          await new Promise((resolve) => setTimeout(resolve, 3000));

          // Get cursors
          const getResult = await runCommand(
            ["spaces", "cursors", "get", spaceName, "--json"],
            {
              env: { ABLY_API_KEY: E2E_API_KEY || "" },
              timeoutMs: 15000,
            },
          );

          expect(getResult.exitCode).toBe(0);

          const cursorRecords = parseNdjsonLines(getResult.stdout);
          const cursorResult = cursorRecords.find((r) => r.type === "result");
          expect(cursorResult).toBeDefined();
          expect(cursorResult!.success).toBe(true);
          const cursors = cursorResult!.cursors as Array<{
            position: { x: number; y: number };
          }>;
          expect(cursors).toBeDefined();
          expect(cursors.length).toBeGreaterThan(0);
          expect(cursors[0].position).toBeDefined();
          expect(typeof cursors[0].position.x).toBe("number");
          expect(typeof cursors[0].position.y).toBe("number");
        } finally {
          const runners: CliRunner[] = [];
          if (subscriberRunner) runners.push(subscriberRunner);
          if (cursorRunner) runners.push(cursorRunner);
          if (runners.length > 0) await cleanupRunners(runners);
        }
      });
    });

    describe("spaces locks", () => {
      it(
        "should acquire a lock and get locks",
        { timeout: 60000 },
        async () => {
          setupTestFailureHandler("should acquire a lock and get locks");

          let lockRunner: CliRunner | null = null;

          try {
            // Acquire a lock (long-running hold command)
            lockRunner = await startPresenceCommand(
              [
                "spaces",
                "locks",
                "acquire",
                spaceName,
                "test-lock-1",
                "--client-id",
                clientId,
                "--duration",
                "15",
              ],
              /Holding|Acquired|lock/i,
              {
                env: { ABLY_API_KEY: E2E_API_KEY || "" },
                timeoutMs: 30000,
              },
            );

            // Wait for lock to propagate
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Get locks
            const getResult = await runCommand(
              ["spaces", "locks", "get", spaceName, "--json"],
              {
                env: { ABLY_API_KEY: E2E_API_KEY || "" },
                timeoutMs: 15000,
              },
            );

            expect(getResult.exitCode).toBe(0);

            const lockRecords = parseNdjsonLines(getResult.stdout);
            const lockResult = lockRecords.find((r) => r.type === "result");
            expect(lockResult).toBeDefined();
            expect(lockResult!.success).toBe(true);
            const locks = lockResult!.locks as Array<{
              id: string;
              status: string;
              member: { clientId: string };
              timestamp: string;
            }>;
            expect(locks).toBeDefined();
            expect(locks.length).toBeGreaterThan(0);
            expect(locks[0].id).toBe("test-lock-1");
            expect(locks[0].status).toBe("locked");
            expect(locks[0].member).toBeDefined();
            expect(locks[0].member.clientId).toBe(clientId);
            expect(locks[0].timestamp).toBeDefined();
          } finally {
            if (lockRunner) {
              await cleanupRunners([lockRunner]);
            }
          }
        },
      );
    });
  },
);
