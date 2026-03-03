// Load environment variables from .env file for tests
import { config } from "dotenv";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { exec } from "node:child_process";
import * as Ably from "ably";

// Import types for test mocks
import type { MockConfigManager } from "./helpers/mock-config-manager.js";

// Global type declarations for test mocks
declare global {
  var __TEST_MOCKS__:
    | {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ablyRestMock: any; // Keep simple 'any' type to match base-command.ts expectations
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ablyChatMock?: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ablySpacesMock?: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ablyRealtimeMock?: any;
        configManager?: MockConfigManager;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [key: string]: any;
      }
    | undefined;
}

// Ensure we're in test mode for all tests
process.env.ABLY_CLI_TEST_MODE = "true";

// Track active resources for cleanup
const activeClients: (Ably.Rest | Ably.Realtime)[] = [];
const globalProcessRegistry = new Set<number>();

// Global process tracking function
export function trackProcess(pid: number): void {
  globalProcessRegistry.add(pid);
  if (process.env.E2E_DEBUG === "true" || process.env.TEST_DEBUG === "true") {
    console.log(`Tracking process PID: ${pid}`);
  }
}

// Global process cleanup function
export async function cleanupGlobalProcesses(): Promise<void> {
  if (globalProcessRegistry.size > 0) {
    if (process.env.E2E_DEBUG === "true" || process.env.TEST_DEBUG === "true") {
      console.log(
        `Cleaning up ${globalProcessRegistry.size} tracked processes...`,
      );
    }

    for (const pid of globalProcessRegistry) {
      try {
        // Check if process exists before trying to kill
        process.kill(pid, 0);
        if (
          process.env.E2E_DEBUG === "true" ||
          process.env.TEST_DEBUG === "true"
        ) {
          console.log(`Killing tracked process PID: ${pid}`);
        }

        // Try graceful kill first
        process.kill(pid, "SIGTERM");
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Check if still alive and force kill
        try {
          process.kill(pid, 0);
          process.kill(pid, "SIGKILL");
          if (
            process.env.E2E_DEBUG === "true" ||
            process.env.TEST_DEBUG === "true"
          ) {
            console.log(`Force killed PID: ${pid}`);
          }
        } catch {
          // Ignore errors
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ESRCH") {
          // Process already dead
        } else {
          console.warn(`Error killing process ${pid}:`, error);
        }
      }
    }

    globalProcessRegistry.clear();
  }

  // Also kill any processes matching our patterns
  try {
    await new Promise<void>((resolve) => {
      exec('pkill -f "bin/run.js.*subscribe"', () => {
        resolve();
      });
    });
    await new Promise<void>((resolve) => {
      exec('pkill -f "ably.*subscribe"', () => {
        resolve();
      });
    });
  } catch {
    // Ignore errors
  }
}

/**
 * Utility to track an Ably client for cleanup
 */
export function trackAblyClient(client: Ably.Rest | Ably.Realtime): void {
  if (!activeClients.includes(client)) {
    activeClients.push(client);
  }
}

// Global cleanup function
export async function globalCleanup(): Promise<void> {
  const clientCount = activeClients.length;
  if (
    clientCount > 0 &&
    (process.env.E2E_DEBUG === "true" || process.env.TEST_DEBUG === "true")
  ) {
    console.log(`Cleaning up ${clientCount} active Ably clients...`);
  }

  // Clean up processes first
  await cleanupGlobalProcesses();

  // Close all clients with timeout
  const cleanup = activeClients.map(async (client) => {
    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        resolve(); // Force resolve after timeout
      }, 2000); // 2 second timeout per client

      try {
        if (client instanceof Ably.Realtime && client.connection) {
          if (
            client.connection.state === "closed" ||
            client.connection.state === "failed"
          ) {
            clearTimeout(timeout);
            resolve();
          } else {
            client.connection.once("closed", () => {
              clearTimeout(timeout);
              resolve();
            });
            client.connection.once("failed", () => {
              clearTimeout(timeout);
              resolve();
            });
            client.close();
          }
        } else {
          clearTimeout(timeout);
          resolve();
        }
      } catch {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  // Wait for all cleanups with overall timeout
  try {
    await Promise.race([
      Promise.all(cleanup),
      new Promise((resolve) => setTimeout(resolve, 5000)), // 5 second overall timeout
    ]);
  } catch {
    // Ignore cleanup errors
  }

  // Clear arrays
  activeClients.length = 0;

  // Force garbage collection if available
  if (globalThis.gc) {
    globalThis.gc();
  }
}

// Load environment variables from .env
const envPath = resolve(process.cwd(), ".env");

if (existsSync(envPath)) {
  const result = config({ path: envPath });

  if (result.error) {
    console.warn(`Warning: Error loading .env file: ${result.error.message}`);
  } else if (
    result.parsed &&
    (process.env.E2E_DEBUG === "true" || process.env.TEST_DEBUG === "true")
  ) {
    console.log(`Loaded environment variables from .env file for tests`);
  }
} else if (
  process.env.E2E_DEBUG === "true" ||
  process.env.TEST_DEBUG === "true"
) {
  console.log(
    "No .env file found. Using environment variables from current environment.",
  );
}
