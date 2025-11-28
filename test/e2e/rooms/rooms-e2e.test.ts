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
  SHOULD_SKIP_E2E,
  getUniqueChannelName,
  getUniqueClientId,
  forceExit,
  cleanupTrackedResources,
  testOutputFiles,
  testCommands,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import {
  startSubscribeCommand,
  startPresenceCommand,
  runCommand,
  waitForOutput,
  cleanupRunners,
} from "../../helpers/command-helpers.js";
import { CliRunner } from "../../helpers/cli-runner.js";

describe("Rooms E2E Tests", () => {
  // Skip all tests if API key not available
  beforeAll(() => {
    process.on("SIGINT", forceExit);
  });

  afterAll(() => {
    process.removeListener("SIGINT", forceExit);
  });

  let testRoom: string;
  let client1Id: string;
  let client2Id: string;

  beforeEach(() => {
    resetTestTracking();
    // Clear tracked output files and commands for this test
    testOutputFiles.clear();
    testCommands.length = 0;

    testRoom = getUniqueChannelName("room");
    client1Id = getUniqueClientId("client1");
    client2Id = getUniqueClientId("client2");
  });

  afterEach(async () => {
    await cleanupTrackedResources();
  });

  describe("Room occupancy functionality", () => {
    it(
      "should show occupancy metrics for active room",
      { timeout: 120000 },
      async () => {
        setupTestFailureHandler(
          "should show occupancy metrics for active room",
        );

        if (SHOULD_SKIP_E2E) return;

        let presenceRunner: CliRunner | null = null;

        try {
          // Start client1 entering presence (this is a long-running command)
          presenceRunner = await startPresenceCommand(
            [
              "rooms",
              "presence",
              "enter",
              testRoom,
              "--data",
              '{"name":"TestUser1"}',
              "--client-id",
              client1Id,
              "--duration",
              "15",
            ],
            /Entered room/,
            { timeoutMs: process.env.CI ? 20000 : 15000 },
          );

          // Wait longer for presence to establish in CI
          const initialWait = process.env.CI ? 5000 : 3000;
          await new Promise((resolve) => setTimeout(resolve, initialWait));

          // Check occupancy metrics multiple times with retry logic
          let occupancyResult: {
            exitCode: number | null;
            stdout: string;
            stderr: string;
          } | null = null;
          let attempts = 0;
          const maxAttempts = process.env.CI ? 5 : 3;

          while (attempts < maxAttempts) {
            attempts++;

            occupancyResult = await runCommand(
              ["rooms", "occupancy", "get", testRoom],
              {
                timeoutMs: process.env.CI ? 15000 : 10000,
              },
            );

            if (
              occupancyResult.exitCode === 0 &&
              occupancyResult.stdout.includes("Connections:") &&
              occupancyResult.stdout.includes("Presence Members:")
            ) {
              break;
            }

            if (attempts < maxAttempts) {
              const retryDelay = 2000 * attempts; // Progressive delay
              await new Promise((resolve) => setTimeout(resolve, retryDelay));
            }
          }

          // Validate final result
          expect(occupancyResult).not.toBeNull();
          expect(occupancyResult!.exitCode).toBe(0);
          expect(occupancyResult!.stdout).toContain("Connections:");
          expect(occupancyResult!.stdout).toContain("Presence Members:");
        } finally {
          // Clean up
          if (presenceRunner) {
            await presenceRunner.kill();
          }
        }
      },
    );
  });

  describe("Presence functionality", () => {
    it(
      "should allow two connections where one person entering is visible to the other",
      { timeout: process.env.CI ? 90000 : 75000 },
      async () => {
        setupTestFailureHandler(
          "should allow two connections where one person entering is visible to the other",
        );

        if (SHOULD_SKIP_E2E) return;

        let subscribeRunner: CliRunner | null = null;
        let enterRunner: CliRunner | null = null;

        try {
          // Start client1 subscribing to presence events
          subscribeRunner = await startSubscribeCommand(
            [
              "rooms",
              "presence",
              "subscribe",
              testRoom,
              "--client-id",
              client1Id,
              "--duration",
              "35",
            ],
            /Subscribing to presence events/,
            { timeoutMs: process.env.CI ? 30000 : 20000 },
          );

          // Wait a moment for client1's subscription to fully establish
          const client1SetupWait = process.env.CI ? 4000 : 2000;
          await new Promise((resolve) => setTimeout(resolve, client1SetupWait));

          // Have client2 enter the room
          enterRunner = await startPresenceCommand(
            [
              "rooms",
              "presence",
              "enter",
              testRoom,
              "--data",
              '{"name":"TestUser2","status":"active"}',
              "--client-id",
              client2Id,
              "--duration",
              "25",
            ],
            /Entered room/,
            { timeoutMs: process.env.CI ? 30000 : 20000 },
          );

          // Add a significant delay for presence event propagation
          const propagationDelay = process.env.CI ? 10000 : 7000;
          await new Promise((resolve) => setTimeout(resolve, propagationDelay));

          // Wait for all presence event components using the improved detection

          try {
            // Wait for action enter pattern - look for the actual format: "clientId enter"
            await waitForOutput(
              subscribeRunner,
              ` ${client2Id} enter`,
              process.env.CI ? 20000 : 15000,
            );

            // Wait for profile data pattern - correct JSON formatting with spaces
            await waitForOutput(
              subscribeRunner,
              `"name": "TestUser2"`,
              process.env.CI ? 10000 : 5000,
            );

            // Wait for status in profile data - correct JSON formatting with spaces
            await waitForOutput(
              subscribeRunner,
              `"status": "active"`,
              process.env.CI ? 5000 : 3000,
            );
          } catch (error) {
            // Re-throw with additional context
            throw new Error(
              `Test failed: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        } finally {
          await cleanupRunners(
            [subscribeRunner, enterRunner].filter(Boolean) as CliRunner[],
          );
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Final wait for cleanup
        }
        expect(true).toBe(true);
      },
    );
  });

  describe("Message publish and subscribe functionality", () => {
    it(
      "should allow publishing and subscribing to messages",
      { timeout: process.env.CI ? 60000 : 45000 },
      async () => {
        setupTestFailureHandler(
          "should allow publishing and subscribing to messages",
        );

        if (SHOULD_SKIP_E2E) return;

        let subscribeRunner: CliRunner | null = null;

        try {
          // Start subscribing to messages with client1
          subscribeRunner = await startSubscribeCommand(
            [
              "rooms",
              "messages",
              "subscribe",
              testRoom,
              "--client-id",
              client1Id,
              "--duration",
              "60",
            ],
            "Connected to room:",
            { timeoutMs: process.env.CI ? 45000 : 25000 },
          );

          // Wait a bit to ensure subscription is established
          const setupWait = process.env.CI ? 3000 : 1000;
          await new Promise((resolve) => setTimeout(resolve, setupWait));

          // Have client2 send a message
          const testMessage = "Hello from E2E test!";
          const sendResult = await runCommand(
            [
              "rooms",
              "messages",
              "send",
              testRoom,
              testMessage,
              "--client-id",
              client2Id,
            ],
            {
              timeoutMs: process.env.CI ? 30000 : 20000,
            },
          );

          // Check for success - either exit code 0 or successful output (even if process was killed after success)
          const isSuccessful =
            sendResult.exitCode === 0 ||
            sendResult.stdout.includes("Message sent successfully");
          expect(isSuccessful).toBe(true);
          expect(sendResult.stdout).toContain("Message sent successfully");

          // Wait for the message to be received by the subscriber
          await waitForOutput(
            subscribeRunner,
            testMessage,
            process.env.CI ? 10000 : 6000,
          );

          await waitForOutput(
            subscribeRunner,
            client2Id,
            process.env.CI ? 5000 : 3000,
          );

          // Send a second message with metadata
          const secondMessage = "Second test message with metadata";
          const metadata = { timestamp: Date.now(), type: "test" };
          const sendResult2 = await runCommand(
            [
              "rooms",
              "messages",
              "send",
              testRoom,
              secondMessage,
              "--metadata",
              JSON.stringify(metadata),
              "--client-id",
              client2Id,
            ],
            {
              timeoutMs: process.env.CI ? 15000 : 10000,
            },
          );

          // Check for success - either exit code 0 or successful output (even if process was killed after success)
          const isSecondSuccessful =
            sendResult2.exitCode === 0 ||
            sendResult2.stdout.includes("Message sent successfully");
          expect(isSecondSuccessful).toBe(true);

          // Wait for the second message to be received
          try {
            await waitForOutput(
              subscribeRunner,
              secondMessage,
              process.env.CI ? 10000 : 6000,
            );
          } catch (waitError) {
            // If waitForOutput fails, check if the message is actually in the output
            const subscriberOutput = subscribeRunner.combined();
            if (subscriberOutput.includes(secondMessage)) {
              // Message was received, the process just exited before waitForOutput finished
              // This is acceptable - the test goal is achieved
            } else {
              throw waitError;
            }
          }
        } catch (error) {
          // Re-throw with additional context
          throw new Error(
            `Test failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        } finally {
          if (subscribeRunner) {
            await subscribeRunner.kill();
          }
        }
      },
    );
  });

  describe("Command Structure Tests", () => {
    it(
      "should have properly structured presence commands",
      { timeout: 30000 },
      async () => {
        setupTestFailureHandler(
          "should have properly structured presence commands",
        );

        if (SHOULD_SKIP_E2E) return;

        // Test help command to ensure command structure exists
        const helpResult = await runCommand([
          "rooms",
          "presence",
          "subscribe",
          "--help",
        ]);
        expect(helpResult.exitCode).toBe(0);
        expect(helpResult.stdout).toContain("Subscribe to presence events");
      },
    );

    it(
      "should have properly structured message commands",
      { timeout: 30000 },
      async () => {
        setupTestFailureHandler(
          "should have properly structured message commands",
        );

        if (SHOULD_SKIP_E2E) return;

        const helpResult = await runCommand([
          "rooms",
          "messages",
          "subscribe",
          "--help",
        ]);
        expect(helpResult.exitCode).toBe(0);
        expect(helpResult.stdout).toContain("Subscribe to messages");
      },
    );
  });
});
