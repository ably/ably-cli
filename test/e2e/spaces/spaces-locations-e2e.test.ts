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
  startSubscribeCommand,
  cleanupRunners,
} from "../../helpers/command-helpers.js";
import type { CliRunner } from "../../helpers/cli-runner.js";

describe.skipIf(SHOULD_SKIP_E2E)(
  "Spaces Locations, Cursors, and Locks E2E Tests",
  () => {
    beforeAll(() => {
      process.on("SIGINT", forceExit);
    });

    afterAll(() => {
      process.removeListener("SIGINT", forceExit);
    });

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
                "--location",
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
