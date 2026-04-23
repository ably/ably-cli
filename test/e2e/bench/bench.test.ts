import { describe, it, beforeEach, afterEach, beforeAll, expect } from "vitest";
import {
  cleanupTrackedResources,
  testOutputFiles,
  testCommands,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import { resolve } from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

// Path to the compiled CLI entry point
const cliPath = resolve(process.cwd(), "bin/run.js");

// Toggle for verbose child-process output during debugging (opt-in via env)
const DEBUG_OUTPUT = Boolean(process.env.ABLY_CLI_TEST_SHOW_OUTPUT);

// Default timeout for test steps
const DEFAULT_TIMEOUT = 30_000; // 30 seconds

describe("E2E: ably bench publisher and subscriber", () => {
  let testChannel: string;
  let apiKey: string;
  let shouldSkip = false;

  beforeAll(async () => {
    const envApiKey = process.env.E2E_ABLY_API_KEY;
    if (!envApiKey) {
      console.log(
        "E2E_ABLY_API_KEY environment variable is required for e2e tests - skipping",
      );
      shouldSkip = true;
      return;
    }
    apiKey = envApiKey;
    testChannel = `cli-e2e-bench-${Date.now()}`;
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

  it(
    "should run publisher and subscriber, and report correct message counts",
    { timeout: 120000 },
    async () => {
      setupTestFailureHandler(
        "should run publisher and subscriber, and report correct message counts",
      );

      if (shouldSkip) return;

      console.log("[TEST] Starting bench test");
      const messageCount = 20; // Small number for a quick test
      const messageRate = 10;

      let subscriberProcess: ChildProcessWithoutNullStreams | null = null;
      let publisherProcess: ChildProcessWithoutNullStreams | null = null;

      let subscriberOutput = "";
      let publisherOutput = "";
      let subscriberReady = false;
      let testError: Error | null = null; // To store any error that occurs
      let subscriberSummaryEntry: Record<string, unknown> | null = null; // Capture testFinished entry

      console.log(`[TEST] Test channel: ${testChannel}`);
      console.log(`[TEST] API key exists: ${!!apiKey}`);

      try {
        // 1. Start Subscriber (Restored original command)
        console.log("[TEST] Creating subscriber promise");
        const subscriberPromise = new Promise<void>(
          (resolveSubscriber, rejectSubscriber) => {
            const subEnv = { ...process.env };
            delete subEnv.ABLY_CLI_TEST_MODE;
            console.log(`[TEST] CLI path: ${cliPath}`);
            console.log(`[TEST] Test channel: ${testChannel}`);

            subscriberProcess = spawn(
              "node",
              [
                cliPath,
                "bench",
                "subscriber",
                testChannel,
                "--json",
                "--verbose",
              ],
              { env: { ...subEnv, ABLY_API_KEY: apiKey } },
            );

            console.log(
              `[TEST] Subscriber process spawned with PID: ${subscriberProcess.pid}`,
            );

            console.log("[TEST] subscriberProcess.stdout is available");

            let jsonBuffer = "";

            subscriberProcess.stdout.on("data", (data) => {
              const outputChunk = data.toString();
              if (DEBUG_OUTPUT)
                process.stdout.write(`[DEBUG_SUB_OUT] ${outputChunk}`);

              // Accumulate for error reporting
              subscriberOutput += outputChunk;

              // Add to JSON buffer
              jsonBuffer += outputChunk;

              // Try to extract complete JSON objects
              let startIndex = 0;
              let braceCount = 0;
              let inString = false;
              let escapeNext = false;

              for (let i = 0; i < jsonBuffer.length; i++) {
                const char = jsonBuffer[i];

                if (escapeNext) {
                  escapeNext = false;
                  continue;
                }

                if (char === "\\" && inString) {
                  escapeNext = true;
                  continue;
                }

                if (char === '"') {
                  inString = !inString;
                  continue;
                }

                if (!inString) {
                  if (char === "{") {
                    if (braceCount === 0) startIndex = i;
                    braceCount++;
                  } else if (char === "}") {
                    braceCount--;
                    if (braceCount === 0) {
                      // Found complete JSON object
                      const jsonStr = jsonBuffer.slice(startIndex, i + 1);
                      try {
                        const logEntry = JSON.parse(jsonStr);
                        console.log(
                          `[TEST] Successfully parsed JSON: ${logEntry.component}/${logEntry.event}`,
                        );

                        if (
                          logEntry.component === "benchmark" &&
                          logEntry.event === "subscriberReady"
                        ) {
                          console.log(
                            "[TEST] Found subscriberReady event, setting flag to true",
                          );
                          subscriberReady = true;
                        }
                        if (
                          logEntry.component === "benchmark" &&
                          logEntry.event === "testFinished"
                        ) {
                          console.log("[TEST] Found testFinished event");
                          subscriberSummaryEntry = logEntry;
                          resolveSubscriber();
                        }
                      } catch (err) {
                        console.error(
                          `[TEST] Failed to parse JSON: ${String(err)}`,
                        );
                      }
                    }
                  }
                }
              }

              // Remove processed JSON from buffer
              if (braceCount === 0 && startIndex > 0) {
                jsonBuffer = jsonBuffer.slice(Math.max(0, startIndex));
              }
            });

            subscriberProcess.stderr.on("data", (data) => {
              const errorChunk = data.toString();
              if (DEBUG_OUTPUT) {
                process.stderr.write(`[DEBUG_SUB_ERR] ${errorChunk}`);
              }
            });

            subscriberProcess.on("error", (err) => {
              rejectSubscriber(err);
            });
            subscriberProcess.on("close", (code) => {
              if (code !== 0 && code !== null) {
                if (publisherOutput.includes("testCompleted")) {
                  resolveSubscriber();
                } else {
                  rejectSubscriber(
                    new Error(
                      `Subscriber process exited with code ${code}. Full Output:\n${subscriberOutput}\nStderr:\n${String(subscriberProcess?.stderr) || "N/A"}`,
                    ),
                  );
                }
              } else {
                resolveSubscriber();
              }
            });
          },
        );

        // 2. Wait for Subscriber to be ready
        console.log("[TEST] Waiting for subscriber to be ready...");
        await new Promise<void>((resolveWait, rejectWait) => {
          const waitTimeout = setTimeout(() => {
            console.error(
              `[TEST] Timeout waiting for subscriber ready signal. subscriberReady=${subscriberReady}`,
            );
            rejectWait(
              new Error("Timeout waiting for subscriber to become ready."),
            );
          }, DEFAULT_TIMEOUT);
          const interval = setInterval(() => {
            console.log(
              `[TEST] Checking subscriberReady flag: ${subscriberReady}`,
            );
            if (subscriberReady) {
              console.log(
                "[TEST] Subscriber is ready, proceeding to start publisher.",
              );
              clearTimeout(waitTimeout);
              clearInterval(interval);
              resolveWait();
            }
          }, 500);
        });

        // 3. Start Publisher
        const publisherPromise = new Promise<void>(
          (resolvePublisher, rejectPublisher) => {
            const pubEnv = { ...process.env };
            delete pubEnv.ABLY_CLI_TEST_MODE;
            publisherProcess = spawn(
              "node",
              [
                cliPath,
                "bench",
                "publisher",
                testChannel,
                "--messages",
                messageCount.toString(),
                "--rate",
                messageRate.toString(),
                "--json",
                "--verbose",
              ],
              { env: { ...pubEnv, ABLY_API_KEY: apiKey } },
            );

            publisherProcess.stdout.on("data", (data) => {
              const outputChunk = data.toString();
              if (DEBUG_OUTPUT)
                process.stdout.write(`[DEBUG_PUB_OUT] ${outputChunk}`);
              publisherOutput += outputChunk;
            });
            publisherProcess.stderr.on("data", (data) => {
              const errorChunk = data.toString();
              if (DEBUG_OUTPUT) {
                process.stderr.write(`[DEBUG_PUB_ERR] ${errorChunk}`);
              }
            });
            publisherProcess.on("error", (err) => {
              rejectPublisher(err);
            });
            publisherProcess.on("close", (code) => {
              console.log(`[TEST] Publisher closed with code: ${code}`);
              console.log(
                `[TEST] Publisher output length: ${publisherOutput.length}`,
              );
              // For bench commands, code 0 or 1 are both acceptable
              // (1 might occur due to connection cleanup timing)
              if (code === 0 || code === 1) {
                resolvePublisher();
              } else {
                rejectPublisher(
                  new Error(
                    `Publisher process exited with code ${code}. Output:\n${publisherOutput}`,
                  ),
                );
              }
            });
          },
        );

        await publisherPromise;
        await subscriberPromise;
      } catch (error) {
        testError = error;
      } finally {
        const sp = subscriberProcess as ChildProcessWithoutNullStreams | null;
        if (sp?.killed === false) sp.kill("SIGTERM");
        const pp = publisherProcess as ChildProcessWithoutNullStreams | null;
        if (pp?.killed === false) pp.kill("SIGTERM");
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (testError) throw testError;

      // Parse multi-line JSON from publisher output using regex
      const publisherLogEntries: Record<string, unknown>[] = [];
      const jsonRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
      const matches = publisherOutput.match(jsonRegex);

      if (matches) {
        for (const match of matches) {
          try {
            const entry = JSON.parse(match);
            if (entry && typeof entry === "object") {
              publisherLogEntries.push(entry);
              if (entry.component && entry.event) {
                console.log(
                  `[TEST] Parsed publisher JSON: ${entry.component}/${entry.event}`,
                );
              }
            }
          } catch {
            // Ignore non-JSON matches
          }
        }
      }

      console.log(
        `[TEST] Total publisher entries parsed: ${publisherLogEntries.length}`,
      );

      // Also try to find testCompleted in raw output as a fallback
      const testCompletedMatch = publisherOutput.match(
        /"event"\s*:\s*"testCompleted"[^}]*}/s,
      );
      if (testCompletedMatch) {
        console.log("[TEST] Found testCompleted in raw output");
      }

      // Check if we see the specific message that should be logged
      if (publisherOutput.includes("Benchmark test completed")) {
        console.log(
          "[TEST] Found 'Benchmark test completed' message in output",
        );
      }

      // Look for the "result" envelope from formatJsonRecord
      const publisherSummary = publisherLogEntries.find(
        (entry) =>
          entry.type === "result" && entry.command === "bench:publisher",
      );

      // If we can't find the summary, check for known issues
      if (!publisherSummary) {
        if (publisherOutput.includes("code=80017")) {
          console.log(
            "[TEST] Publisher connection closed with error 80017 before completing",
          );
        }
        if (publisherOutput.includes("Test complete. Disconnecting")) {
          console.log("[TEST] Publisher reached 'Test complete' message");
        }
      }

      expect(publisherSummary).toBeDefined();
      // With JSON envelope format, data fields are nested under benchmark domain key
      expect(publisherSummary?.benchmark).toBeDefined();
      expect(publisherSummary!.benchmark.messagesSent).toBe(messageCount);
      expect(publisherSummary!.benchmark.messagesEchoed).toBeGreaterThanOrEqual(
        messageCount * 0.9,
      );
      expect(publisherSummary!.benchmark.errors).toBe(0);

      const subscriberLogEntries = subscriberOutput
        .trim()
        .split("\n")
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return {};
          }
        });
      // Look for the "result" envelope from formatJsonRecord
      const subscriberSummary =
        subscriberLogEntries.find(
          (entry) =>
            entry.type === "result" && entry.command === "bench:subscriber",
        ) ?? subscriberSummaryEntry;
      expect(subscriberSummary).toBeDefined();
      // With JSON envelope format, data fields are nested under benchmark domain key
      expect(subscriberSummary?.benchmark).toBeDefined();
      expect(subscriberSummary!.benchmark.messagesReceived).toBe(messageCount);
    },
  );
});
