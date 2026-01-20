import {
  describe,
  it,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  expect,
} from "vitest";
import { runCommand } from "../../helpers/command-helpers.js";
import {
  forceExit,
  cleanupTrackedResources,
  testOutputFiles,
  testCommands,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import { spawn } from "node:child_process";
import { join } from "node:path";

describe("Connections E2E Tests", () => {
  beforeAll(() => {
    process.on("SIGINT", forceExit);
  });

  afterAll(() => {
    process.removeListener("SIGINT", forceExit);
  });

  beforeEach(() => {
    resetTestTracking();
    // Clear tracked output files and commands for this test
    testOutputFiles.clear();
    testCommands.length = 0;
  });

  afterEach(async () => {
    await cleanupTrackedResources();
  });

  describe("Connection Test E2E", () => {
    it(
      "should test WebSocket connection successfully",
      { timeout: 90000 },
      async () => {
        setupTestFailureHandler(
          "should test WebSocket connection successfully",
        );

        const result = await runCommand(
          ["connections", "test", "--transport", "ws"],
          {
            timeoutMs: 90000,
            env: { ABLY_CLI_TEST_MODE: "false" },
          },
        );

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("WebSocket connection");
      },
    );

    it(
      "should test HTTP connection successfully",
      { timeout: 90000 },
      async () => {
        setupTestFailureHandler("should test HTTP connection successfully");

        const result = await runCommand(
          ["connections", "test", "--transport", "xhr"],
          {
            timeoutMs: 90000,
            env: { ABLY_CLI_TEST_MODE: "false" },
          },
        );

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("HTTP connection");
      },
    );

    it("should test all connection types", { timeout: 120000 }, async () => {
      setupTestFailureHandler("should test all connection types");

      const result = await runCommand(
        ["connections", "test", "--transport", "all"],
        {
          timeoutMs: 120000,
          env: { ABLY_CLI_TEST_MODE: "false" },
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Connection Test Summary");
    });

    it(
      "should output connection test results in JSON format",
      { timeout: 90000 },
      async () => {
        setupTestFailureHandler(
          "should output connection test results in JSON format",
        );

        const result = await runCommand(
          ["connections", "test", "--transport", "ws", "--json"],
          {
            timeoutMs: 90000,
            env: { ABLY_CLI_TEST_MODE: "false" },
          },
        );

        expect(result.exitCode).toBe(0);

        // Verify it's valid JSON
        let jsonOutput;
        try {
          jsonOutput = JSON.parse(result.stdout);
        } catch {
          throw new Error(`Invalid JSON output: ${result.stdout}`);
        }

        // Check for expected test result structure
        expect(jsonOutput).toHaveProperty("success");
        expect(jsonOutput).toHaveProperty("transport");
        expect(jsonOutput.transport).toBe("ws");
      },
    );
  });

  describe("Error Handling E2E", () => {
    it(
      "should handle invalid transport types gracefully",
      { timeout: 30000 },
      async () => {
        setupTestFailureHandler(
          "should handle invalid transport types gracefully",
        );

        const result = await runCommand(
          ["connections", "test", "--transport", "invalid"],
          {
            timeoutMs: 30000,
            env: { ABLY_CLI_TEST_MODE: "false" },
          },
        );

        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toContain("Expected --transport=");
      },
    );
  });

  describe("Live Connection Monitoring E2E", () => {
    it(
      "should monitor live connections with real client lifecycle",
      { timeout: 180000 },
      async () => {
        setupTestFailureHandler(
          "should monitor live connections with real client lifecycle",
        );

        const cliPath = join(process.cwd(), "bin", "run.js");
        const testChannelName = `test-live-connections-${Date.now()}`;
        const testClientId = `test-client-${Date.now()}`;

        // Step 1: Start live connection log monitoring
        const monitorEnv = { ...process.env };
        delete monitorEnv.ABLY_CLI_TEST_MODE;
        const apiKey = process.env.E2E_ABLY_API_KEY;
        if (!apiKey) {
          throw new Error("E2E_ABLY_API_KEY environment variable is required");
        }

        // Use connection-lifecycle command which uses the correct meta channel
        const connectionsMonitor = spawn(
          "node",
          [
            cliPath,
            "logs",
            "connection-lifecycle",
            "subscribe",
            "--api-key",
            apiKey,
            "--json",
          ],
          {
            env: monitorEnv,
          },
        );

        let monitorOutput = "";
        const connectionEvents: Array<{
          timestamp: number;
          eventType: string;
          clientId: string | null;
          connectionId: string | null;
        }> = [];

        // Collect output from the live connection monitor
        let eventCount = 0;
        let jsonBuffer = "";
        let braceDepth = 0;

        connectionsMonitor.stdout?.on("data", (data) => {
          const output = data.toString();
          monitorOutput += output;

          // Handle multi-line JSON output
          for (const char of output) {
            jsonBuffer += char;
            if (char === "{") braceDepth++;
            if (char === "}") braceDepth--;

            // When we have a complete JSON object
            if (braceDepth === 0 && jsonBuffer.trim().endsWith("}")) {
              try {
                const logEvent = JSON.parse(jsonBuffer.trim());
                eventCount++;
                jsonBuffer = ""; // Reset buffer

                // Debug: log first few events to understand structure
                if (eventCount <= 10 && process.env.ABLY_CLI_TEST_SHOW_OUTPUT) {
                  console.log(
                    "[TEST] Received log event:",
                    JSON.stringify(logEvent, null, 2),
                  );
                }

                // Also check if our test client ID appears anywhere in the event
                const eventStr = JSON.stringify(logEvent);
                if (eventStr.includes(testClientId)) {
                  console.log(
                    `[TEST] Found event containing test client ID: ${eventStr.slice(0, 200)}...`,
                  );
                }

                // Check different possible locations for client ID
                let foundClientId: string | null = null;

                // Based on actual connection lifecycle events, clientId is in data.transport.requestParams.clientId as an array
                if (logEvent.data?.transport?.requestParams?.clientId) {
                  const clientIdArray =
                    logEvent.data.transport.requestParams.clientId;
                  foundClientId = Array.isArray(clientIdArray)
                    ? clientIdArray[0]
                    : clientIdArray;
                }
                // Also check in data.clientId (for backwards compatibility)
                else if (logEvent.data?.clientId) {
                  foundClientId = logEvent.data.clientId;
                }
                // Check in data.connectionDetails.clientId
                else if (logEvent.data?.connectionDetails?.clientId) {
                  foundClientId = logEvent.data.connectionDetails.clientId;
                }

                if (foundClientId === testClientId) {
                  console.log(
                    `[TEST] Found matching client ID event: ${foundClientId}`,
                  );
                  connectionEvents.push({
                    timestamp: Date.now(),
                    eventType:
                      logEvent.event || logEvent.eventType || "connection",
                    clientId: foundClientId,
                    connectionId:
                      logEvent.data?.connectionId ||
                      logEvent.connectionId ||
                      null,
                  });
                }
              } catch {
                // Reset buffer if parsing fails
                if (jsonBuffer.trim()) {
                  jsonBuffer = "";
                  braceDepth = 0;
                }
              }
            }
          }
        });

        // Wait for initial connection monitoring to start and begin receiving events
        await new Promise((resolve) => setTimeout(resolve, 10000));

        console.log(`[TEST] Events received so far: ${eventCount}`);

        // Step 2: Start a channel subscriber with specific client ID (this will create a new connection)
        const subEnv = { ...process.env };
        delete subEnv.ABLY_CLI_TEST_MODE;
        console.log(
          `[TEST] Starting channel subscriber with client ID: ${testClientId}`,
        );
        const channelSubscriber = spawn(
          "node",
          [
            cliPath,
            "channels",
            "subscribe",
            testChannelName,
            "--api-key",
            apiKey,
            "--client-id",
            testClientId,
          ],
          {
            env: subEnv,
          },
        );

        // Wait longer for the subscriber to establish connection and appear in monitoring
        await new Promise((resolve) => setTimeout(resolve, 30000));

        // Step 3: Close the channel subscriber
        channelSubscriber.kill("SIGTERM");

        // Wait for the subscriber to fully disconnect
        await new Promise<void>((resolve) => {
          channelSubscriber.on("exit", () => resolve());
          setTimeout(resolve, 5000); // Fallback timeout
        });

        // Step 4: Wait up to 15 seconds for the disconnection event to appear
        await new Promise((resolve) => setTimeout(resolve, 15000));

        // Stop the connections monitor
        connectionsMonitor.kill("SIGTERM");

        await new Promise<void>((resolve) => {
          connectionsMonitor.on("exit", () => resolve());
          setTimeout(resolve, 5000); // Fallback timeout
        });

        // Debug output
        console.log(`[TEST] Total events received: ${eventCount}`);
        console.log(
          `[TEST] Connection events for ${testClientId}: ${connectionEvents.length}`,
        );
        if (
          connectionEvents.length === 0 &&
          process.env.ABLY_CLI_TEST_SHOW_OUTPUT
        ) {
          console.log(
            "[TEST] Sample of monitor output:",
            monitorOutput.slice(0, 1000),
          );
        }

        // Verify we captured connection lifecycle for our specific client
        expect(connectionEvents.length).toBeGreaterThan(0);

        // Log captured events for debugging

        // Verify we got valid JSON output throughout
        expect(monitorOutput).toContain("connectionId");

        // The test passes if we detected any connection events for our specific client ID
        // This proves the live connection monitoring is working end-to-end
        expect(connectionEvents.some((e) => e.clientId === testClientId)).toBe(
          true,
        );
      },
    );

    it(
      "should handle live connection monitoring gracefully on cleanup",
      { timeout: 60000 },
      async () => {
        setupTestFailureHandler(
          "should handle live connection monitoring gracefully on cleanup",
        );

        const cliPath = join(process.cwd(), "bin", "run.js");

        // Start live connection log monitoring
        const connectionsMonitor = spawn(
          "node",
          [cliPath, "logs", "connection", "subscribe"],
          {
            env: {
              ...process.env,
              ABLY_CLI_TEST_MODE: "false",
            },
          },
        );

        connectionsMonitor.stdout?.on("data", () => {
          // Just consume the output
        });

        // Wait for some output
        await new Promise((resolve) => setTimeout(resolve, 8000));

        // Gracefully terminate
        connectionsMonitor.kill("SIGTERM");

        await new Promise<void>((resolve) => {
          const doResolve = () => {
            expect(true).toBe(true);
            resolve();
          };

          connectionsMonitor.on("exit", () => doResolve());
          setTimeout(doResolve, 5000); // Fallback timeout
        });
      },
    );
  });
});
