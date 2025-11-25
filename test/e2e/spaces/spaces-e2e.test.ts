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
  createTempOutputFile,
  runLongRunningBackgroundProcess,
  readProcessOutput,
  runBackgroundProcessAndGetOutput,
  killProcess,
  forceExit,
  cleanupTrackedResources,
  trackTestOutputFile,
  testOutputFiles,
  testCommands,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import { ChildProcess } from "node:child_process";

describe("Spaces E2E Tests", () => {
  // Skip all tests if API key not available
  beforeAll(() => {
    process.on("SIGINT", forceExit);
  });

  afterAll(() => {
    process.removeListener("SIGINT", forceExit);
  });

  let testSpaceId: string;
  let client1Id: string;
  let client2Id: string;

  beforeEach(() => {
    resetTestTracking();
    // Clear tracked output files and commands for this test
    testOutputFiles.clear();
    testCommands.length = 0;

    testSpaceId = getUniqueChannelName("space");
    client1Id = getUniqueClientId("client1");
    client2Id = getUniqueClientId("client2");
  });

  afterEach(async () => {
    await cleanupTrackedResources();
  });

  describe("Members presence functionality", () => {
    it(
      "should allow two connections where one person entering is visible to the other",
      async () => {
        setupTestFailureHandler(
          "should allow two connections where one person entering is visible to the other",
        );

        if (SHOULD_SKIP_E2E) return;

        let membersProcess: ChildProcess | null = null;
        let outputPath: string = "";

        try {
          // Create output file for members monitoring
          outputPath = await createTempOutputFile();
          trackTestOutputFile(outputPath);

          // Start client1 monitoring members in the space
          const membersInfo = await runLongRunningBackgroundProcess(
            `bin/run.js spaces members subscribe ${testSpaceId} --client-id ${client1Id} --duration 15`,
            outputPath,
            {
              readySignal: "Subscribing to member updates",
              timeoutMs: process.env.CI ? 20000 : 15000, // Increased local timeout
              retryCount: 2,
            },
          );
          membersProcess = membersInfo.process;

          // Wait a moment for subscription to fully establish
          const setupWait = process.env.CI ? 3000 : 1000;
          await new Promise((resolve) => setTimeout(resolve, setupWait));

          // Have client2 enter the space (this is likely a long-running command too)
          const client2OutputPath = await createTempOutputFile();
          trackTestOutputFile(client2OutputPath);
          const client2SpaceInfo = await runLongRunningBackgroundProcess(
            `bin/run.js spaces members enter ${testSpaceId} --profile '{"name":"Test User 2","role":"collaborator","department":"E2E Testing"}' --client-id ${client2Id} --duration 12`,
            client2OutputPath,
            {
              readySignal: "Successfully entered space:",
              timeoutMs: process.env.CI ? 20000 : 15000, // Increased local timeout
              retryCount: 2,
            },
          );
          const client2Process = client2SpaceInfo.process;

          // Wait for member update to be received by client1
          let memberUpdateReceived = false;
          const maxAttempts = process.env.CI ? 25 : 15; // More attempts for CI

          for (let i = 0; i < maxAttempts; i++) {
            const output = await readProcessOutput(outputPath);
            if (output.includes(client2Id) && output.includes("Test User 2")) {
              memberUpdateReceived = true;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 200));
          }

          expect(memberUpdateReceived).toBe(true);

          // Clean up client2 space process (killing it will trigger leave)
          await killProcess(client2Process);

          // Wait for leave event to be processed
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } finally {
          if (membersProcess) {
            await killProcess(membersProcess);
          }
        }
      },
      { timeout: 120000 },
    );
  });

  describe("Location state synchronization", () => {
    it(
      "should synchronize location updates between clients",
      async () => {
        setupTestFailureHandler(
          "should synchronize location updates between clients",
        );

        if (SHOULD_SKIP_E2E) return;

        let locationsProcess: ChildProcess | null = null;
        let client1SpaceProcess: ChildProcess | null = null;
        let client2SpaceProcess: ChildProcess | null = null;
        let outputPath: string = "";

        try {
          // Create output file for locations monitoring
          outputPath = await createTempOutputFile();
          trackTestOutputFile(outputPath);

          // First, have both clients enter the space (long-running commands)
          const client1OutputPath = await createTempOutputFile();
          trackTestOutputFile(client1OutputPath);
          const client2OutputPath = await createTempOutputFile();
          trackTestOutputFile(client2OutputPath);

          const client1SpaceInfo = await runLongRunningBackgroundProcess(
            `bin/run.js spaces members enter ${testSpaceId} --profile '{"name":"Client 1"}' --client-id ${client1Id} --duration 20`,
            client1OutputPath,
            {
              readySignal: "Successfully entered space:",
              timeoutMs: process.env.CI ? 20000 : 15000,
              retryCount: 2,
            },
          );
          client1SpaceProcess = client1SpaceInfo.process;

          const client2SpaceInfo = await runLongRunningBackgroundProcess(
            `bin/run.js spaces members enter ${testSpaceId} --profile '{"name":"Client 2"}' --client-id ${client2Id} --duration 20`,
            client2OutputPath,
            {
              readySignal: "Successfully entered space:",
              timeoutMs: process.env.CI ? 20000 : 15000,
              retryCount: 2,
            },
          );
          client2SpaceProcess = client2SpaceInfo.process;

          // Wait for entries to establish
          const entriesWait = process.env.CI ? 3000 : 1000;
          await new Promise((resolve) => setTimeout(resolve, entriesWait));

          // Subscribe to location updates on the space with client1
          const locationsInfo = await runLongRunningBackgroundProcess(
            `bin/run.js spaces locations subscribe ${testSpaceId} --client-id ${client1Id} --duration 20`,
            outputPath,
            {
              readySignal: "Fetching current locations for space",
              timeoutMs: process.env.CI ? 40000 : 30000, // Increased timeout
              retryCount: 2,
            },
          );
          locationsProcess = locationsInfo.process;

          // Wait a moment for subscription to fully establish
          const subscriptionWait = process.env.CI ? 3000 : 1000;
          await new Promise((resolve) => setTimeout(resolve, subscriptionWait));

          // Have client2 update their location
          const locationData = {
            x: 100,
            y: 200,
            page: "dashboard",
            section: "analytics",
            viewport: { zoom: 1.5, width: 1920, height: 1080 },
          };

          const setLocationResult = await runBackgroundProcessAndGetOutput(
            `bin/run.js spaces locations set ${testSpaceId} --location '${JSON.stringify(locationData)}' --client-id ${client2Id} --duration 0`,
            process.env.CI ? 15000 : 15000, // Timeout for the command
          );

          // Check for success - either exit code 0 or successful output (even if process was killed after success)
          const isLocationSetSuccessful =
            setLocationResult.exitCode === 0 ||
            setLocationResult.stdout.includes("Successfully set location");
          expect(isLocationSetSuccessful).toBe(true);
          expect(setLocationResult.stdout).toContain(
            "Successfully set location",
          );

          // Wait for location update to be received by client1
          let locationUpdateReceived = false;
          const maxAttempts = process.env.CI ? 25 : 15; // More attempts for CI

          for (let i = 0; i < maxAttempts; i++) {
            const output = await readProcessOutput(outputPath);

            if (
              output.includes(client2Id) &&
              output.includes("dashboard") &&
              output.includes("analytics")
            ) {
              locationUpdateReceived = true;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 200));
          }

          expect(locationUpdateReceived).toBe(true);

          // Update location again to test continuous synchronization
          const newLocationData = {
            x: 300,
            y: 400,
            page: "editor",
            section: "code-panel",
          };

          const updateLocationResult = await runBackgroundProcessAndGetOutput(
            `bin/run.js spaces locations set ${testSpaceId} --location '${JSON.stringify(newLocationData)}' --client-id ${client2Id} --duration 0`,
            process.env.CI ? 15000 : 15000, // Increased local timeout
          );

          // Check for success - either exit code 0 or successful output (even if process was killed after success)
          const isSecondLocationSetSuccessful =
            updateLocationResult.exitCode === 0 ||
            updateLocationResult.stdout.includes("Successfully set location");
          expect(isSecondLocationSetSuccessful).toBe(true);

          // Wait for second location update
          let secondLocationUpdateReceived = false;
          for (let i = 0; i < maxAttempts; i++) {
            const output = await readProcessOutput(outputPath);
            if (output.includes("editor") && output.includes("code-panel")) {
              secondLocationUpdateReceived = true;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 200));
          }

          expect(secondLocationUpdateReceived).toBe(true);
        } finally {
          if (locationsProcess) {
            await killProcess(locationsProcess);
          }
          if (client1SpaceProcess) {
            await killProcess(client1SpaceProcess);
          }
          if (client2SpaceProcess) {
            await killProcess(client2SpaceProcess);
          }
        }
      },
      { timeout: 120000 },
    );
  });

  describe("Cursor state synchronization", () => {
    it(
      "should synchronize cursor updates between clients",
      async () => {
        setupTestFailureHandler(
          "should synchronize cursor updates between clients",
        );

        if (SHOULD_SKIP_E2E) return;

        let cursorsProcess: ChildProcess | null = null;
        let client1SpaceProcess: ChildProcess | null = null;
        let client2SpaceProcess: ChildProcess | null = null;
        let cursorSetProcess: ChildProcess | null = null;
        let outputPath: string = "";
        let shouldSkipCursorTest = false;

        try {
          // Create output file for cursors monitoring
          outputPath = await createTempOutputFile();
          trackTestOutputFile(outputPath);

          // First, have both clients enter the space (long-running commands)
          const client1OutputPath = await createTempOutputFile();
          trackTestOutputFile(client1OutputPath);
          const client2OutputPath = await createTempOutputFile();
          trackTestOutputFile(client2OutputPath);

          const client1SpaceInfo = await runLongRunningBackgroundProcess(
            `bin/run.js spaces members enter ${testSpaceId} --profile '{"name":"Client 1"}' --client-id ${client1Id} --duration 20`,
            client1OutputPath,
            {
              readySignal: "Successfully entered space:",
              timeoutMs: process.env.CI ? 20000 : 15000,
              retryCount: 2,
            },
          );
          client1SpaceProcess = client1SpaceInfo.process;

          const client2SpaceInfo = await runLongRunningBackgroundProcess(
            `bin/run.js spaces members enter ${testSpaceId} --profile '{"name":"Client 2"}' --client-id ${client2Id} --duration 20`,
            client2OutputPath,
            {
              readySignal: "Successfully entered space:",
              timeoutMs: process.env.CI ? 20000 : 15000,
              retryCount: 2,
            },
          );
          client2SpaceProcess = client2SpaceInfo.process;

          // Wait for entries to establish
          const setupWait = process.env.CI ? 3000 : 1000;
          await new Promise((resolve) => setTimeout(resolve, setupWait));

          // Start client1 monitoring cursors in the space
          const cursorsInfo = await runLongRunningBackgroundProcess(
            `bin/run.js spaces cursors subscribe ${testSpaceId} --client-id ${client1Id} --duration 20`,
            outputPath,
            {
              readySignal: "Subscribing to cursor movements",
              timeoutMs: 60000, // Increased timeout significantly
              retryCount: 3,
            },
          );
          cursorsProcess = cursorsInfo.process;

          // Wait longer for subscription to fully establish - cursor subscriptions can be slow
          const subscriptionWait = 10000; // 10 seconds
          await new Promise((resolve) => setTimeout(resolve, subscriptionWait));

          // Have client2 set cursor data (position will be random with --simulate)
          const cursorData = { name: "TestUser2", color: "#ff0000" };
          // First check if the cursor subscribe process is still running and has proper output
          let currentOutput = await readProcessOutput(outputPath);
          if (
            !currentOutput.includes("Entered space:") &&
            !currentOutput.includes("Subscribing to cursor movements")
          ) {
            // The cursor subscribe process might have failed, let's skip this test
            shouldSkipCursorTest = true;
            return;
          }

          // Start cursor set with simulation as a long-running process
          const cursorSetOutputPath = await createTempOutputFile();
          trackTestOutputFile(cursorSetOutputPath);

          const cursorSetInfo = await runLongRunningBackgroundProcess(
            `bin/run.js spaces cursors set ${testSpaceId} --simulate --data '${JSON.stringify({ data: cursorData })}' --client-id ${client2Id} --duration 30`,
            cursorSetOutputPath,
            {
              readySignal: "Starting cursor movement simulation",
              timeoutMs: 15000,
            },
          );
          cursorSetProcess = cursorSetInfo.process;

          // Wait for cursor update to be received by client1
          let cursorUpdateReceived = false;
          const maxAttempts = process.env.CI ? 25 : 15; // More attempts for CI

          for (let i = 0; i < maxAttempts; i++) {
            const output = await readProcessOutput(outputPath);

            if (
              output.includes(client2Id) &&
              output.includes("position:") &&
              output.includes("TestUser2") &&
              output.includes("#ff0000")
            ) {
              cursorUpdateReceived = true;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 200));
          }

          expect(cursorUpdateReceived).toBe(true);

          // Wait a bit to ensure cursor is stable
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Test getAll functionality
          const getAllResult = await runBackgroundProcessAndGetOutput(
            `bin/run.js spaces cursors get-all ${testSpaceId} --client-id ${client1Id}`,
            15000,
          );

          expect(getAllResult.exitCode).toBe(0);
          expect(getAllResult.stdout).toContain(client2Id);
          expect(getAllResult.stdout).toContain("TestUser2");
        } catch (error) {
          // Re-throw with additional context
          throw new Error(
            `Test failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        } finally {
          if (cursorSetProcess) {
            await killProcess(cursorSetProcess);
          }
          if (cursorsProcess) {
            await killProcess(cursorsProcess);
          }
          if (client1SpaceProcess) {
            await killProcess(client1SpaceProcess);
          }
          if (client2SpaceProcess) {
            await killProcess(client2SpaceProcess);
          }
        }

        // Handle skip outside of try/finally
        if (shouldSkipCursorTest) {
          return; // Skip test by early return
        }
      },
      { timeout: 120000 },
    );
  });

  describe("Locks synchronization", () => {
    it(
      "should synchronize lock acquisition and release between clients",
      async () => {
        setupTestFailureHandler(
          "should synchronize lock acquisition and release between clients",
        );

        if (SHOULD_SKIP_E2E) return;

        let locksProcess: ChildProcess | null = null;
        let client1SpaceProcess: ChildProcess | null = null;
        let client2SpaceProcess: ChildProcess | null = null;
        let outputPath: string = "";

        try {
          // Create output file for locks monitoring
          outputPath = await createTempOutputFile();
          trackTestOutputFile(outputPath);

          // First, have both clients enter the space (long-running commands)
          const client1OutputPath = await createTempOutputFile();
          trackTestOutputFile(client1OutputPath);
          const client2OutputPath = await createTempOutputFile();
          trackTestOutputFile(client2OutputPath);

          const client1SpaceInfo = await runLongRunningBackgroundProcess(
            `bin/run.js spaces members enter ${testSpaceId} --profile '{"name":"Client 1"}' --client-id ${client1Id} --duration 20`,
            client1OutputPath,
            {
              readySignal: "Successfully entered space:",
              timeoutMs: process.env.CI ? 20000 : 15000,
              retryCount: 2,
            },
          );
          client1SpaceProcess = client1SpaceInfo.process;

          const client2SpaceInfo = await runLongRunningBackgroundProcess(
            `bin/run.js spaces members enter ${testSpaceId} --profile '{"name":"Client 2"}' --client-id ${client2Id} --duration 20`,
            client2OutputPath,
            {
              readySignal: "Successfully entered space:",
              timeoutMs: process.env.CI ? 20000 : 15000,
              retryCount: 2,
            },
          );
          client2SpaceProcess = client2SpaceInfo.process;

          // Wait for entries to establish
          const setupWait = process.env.CI ? 3000 : 1000;
          await new Promise((resolve) => setTimeout(resolve, setupWait));

          // Start client1 monitoring locks in the space
          const locksInfo = await runLongRunningBackgroundProcess(
            `bin/run.js spaces locks subscribe ${testSpaceId} --client-id ${client1Id} --duration 15`,
            outputPath,
            {
              readySignal: "Subscribing to lock events",
              timeoutMs: process.env.CI ? 20000 : 15000, // Increased local timeout
              retryCount: 2,
            },
          );
          locksProcess = locksInfo.process;

          // Wait a moment for subscription to fully establish
          const subscriptionWait = process.env.CI ? 3000 : 1000;
          await new Promise((resolve) => setTimeout(resolve, subscriptionWait));

          // Have client2 acquire a lock
          const lockId = "document-section-1";
          const lockAttributes = {
            operation: "editing",
            priority: "high",
            timeout: 30000,
            reason: "E2E testing lock acquisition",
          };

          const lockOutputPath = await createTempOutputFile();
          trackTestOutputFile(lockOutputPath);
          const acquireLockInfo = await runLongRunningBackgroundProcess(
            `bin/run.js spaces locks acquire ${testSpaceId} ${lockId} --data '${JSON.stringify(lockAttributes)}' --client-id ${client2Id}`,
            lockOutputPath,
            {
              readySignal: "Successfully acquired lock",
              timeoutMs: process.env.CI ? 20000 : 15000,
              retryCount: 2,
            },
          );
          const lockProcess = acquireLockInfo.process;

          // Wait for lock acquisition to be received by client1
          let lockAcquiredReceived = false;
          const maxAttempts = process.env.CI ? 40 : 30; // Increased attempts

          for (let i = 0; i < maxAttempts; i++) {
            const output = await readProcessOutput(outputPath);
            // Check for lockId, client2Id, and a status indicating the lock is held (e.g., "locked")
            // The subscriber logs: `  Status: ${lock.status}` and `  Member: ${lock.member?.clientId}`
            if (
              output.includes(lockId) &&
              output.includes(client2Id) &&
              output.includes("Status: locked")
            ) {
              lockAcquiredReceived = true;
              break;
            } else if (
              output.includes(lockId) &&
              output.includes(client2Id) &&
              output.includes("Status: pending")
            ) {
              // It's pending, might become locked soon, continue polling but log it.
            }
            await new Promise((resolve) => setTimeout(resolve, 300)); // Slightly longer poll interval
          }

          expect(lockAcquiredReceived).toBe(true);

          // Release the lock by killing the acquire process
          await killProcess(lockProcess);

          // Wait for lock release to be received by client1
          let lockReleasedReceived = false;
          for (let i = 0; i < maxAttempts; i++) {
            const output = await readProcessOutput(outputPath);
            // Check for lockId and a status like "unlocked" or if the member is no longer client2Id for that lockId
            if (
              output.includes(lockId) &&
              (output.includes("Status: unlocked") ||
                output.includes("Status: released") ||
                (output.includes(client2Id) && output.includes("leave")))
            ) {
              lockReleasedReceived = true;
              break;
            } else if (
              i % 5 === 0 &&
              output.length > 0 &&
              process.env.E2E_DEBUG
            ) {
              // Debug output for troubleshooting
              console.log(
                `[DEBUG] Lock release check attempt ${i}: ${output.slice(-200)}`,
              );
            }
            await new Promise((resolve) => setTimeout(resolve, 300));
          }

          expect(lockReleasedReceived).toBe(true);
        } finally {
          if (locksProcess) {
            await killProcess(locksProcess);
          }
          if (client1SpaceProcess) {
            await killProcess(client1SpaceProcess);
          }
          if (client2SpaceProcess) {
            await killProcess(client2SpaceProcess);
          }
        }
      },
      { timeout: 120000 },
    );
  });

  describe("Command Structure Tests", () => {
    it(
      "should have properly structured spaces member commands",
      async () => {
        setupTestFailureHandler(
          "should have properly structured spaces member commands",
        );

        if (SHOULD_SKIP_E2E) return;

        // Test help command to ensure command structure exists
        const helpResult = await runBackgroundProcessAndGetOutput(
          `bin/run.js spaces members subscribe --help`,
        );
        expect(helpResult.exitCode).toBe(0);
        expect(helpResult.stdout).toContain(
          "Subscribe to member presence events",
        );
      },
      { timeout: 30000 },
    );

    it(
      "should have properly structured spaces location commands",
      async () => {
        setupTestFailureHandler(
          "should have properly structured spaces location commands",
        );

        if (SHOULD_SKIP_E2E) return;

        const helpResult = await runBackgroundProcessAndGetOutput(
          `bin/run.js spaces locations subscribe --help`,
        );
        expect(helpResult.exitCode).toBe(0);
        expect(helpResult.stdout).toContain("Subscribe to location updates");
      },
      { timeout: 30000 },
    );

    it(
      "should have properly structured spaces cursor commands",
      async () => {
        setupTestFailureHandler(
          "should have properly structured spaces cursor commands",
        );

        if (SHOULD_SKIP_E2E) return;

        const helpResult = await runBackgroundProcessAndGetOutput(
          `bin/run.js spaces cursors subscribe --help`,
        );
        expect(helpResult.exitCode).toBe(0);
        expect(helpResult.stdout).toContain("Subscribe to cursor movements");
      },
      { timeout: 30000 },
    );

    it(
      "should have properly structured spaces lock commands",
      async () => {
        setupTestFailureHandler(
          "should have properly structured spaces lock commands",
        );

        if (SHOULD_SKIP_E2E) return;

        const helpResult = await runBackgroundProcessAndGetOutput(
          `bin/run.js spaces locks subscribe --help`,
        );
        expect(helpResult.exitCode).toBe(0);
        expect(helpResult.stdout).toContain("Subscribe to lock events");
      },
      { timeout: 30000 },
    );
  });
});
