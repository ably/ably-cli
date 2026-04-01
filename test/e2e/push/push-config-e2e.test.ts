import {
  describe,
  it,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  expect,
} from "vitest";
import { ControlApi } from "../../../src/services/control-api.js";
import {
  forceExit,
  cleanupTrackedResources,
  testOutputFiles,
  testCommands,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import { runCommand } from "../../helpers/command-helpers.js";
import { parseNdjsonLines } from "../../helpers/ndjson.js";
import { resolve } from "node:path";

describe("Push Config E2E Tests", () => {
  let controlApi: ControlApi;
  let testAppId: string;
  let shouldSkip = false;

  beforeAll(async () => {
    process.on("SIGINT", forceExit);

    const accessToken = process.env.E2E_ABLY_ACCESS_TOKEN;
    if (!accessToken) {
      console.log(
        "E2E_ABLY_ACCESS_TOKEN not available, skipping Push Config E2E tests",
      );
      shouldSkip = true;
      return;
    }

    controlApi = new ControlApi({
      accessToken,
      logErrors: false,
    });

    // Create a dedicated test app for push config tests
    // Let setup failures propagate — only missing credentials should skip
    const appName = `E2E Push Config Test ${Date.now()}`;
    const createResult = await runCommand(
      ["apps", "create", "--name", appName, "--json"],
      {
        env: { ABLY_ACCESS_TOKEN: accessToken },
      },
    );

    const result = parseNdjsonLines(createResult.stdout).find(
      (r) => r.type === "result",
    )!;
    testAppId = (result.app as Record<string, unknown>).id as string;
    console.log(`Created test app for push config: ${testAppId}`);
  });

  afterAll(async () => {
    if (testAppId) {
      try {
        await controlApi.deleteApp(testAppId);
        console.log(`Deleted test app: ${testAppId}`);
      } catch (error) {
        console.warn(`Failed to delete test app ${testAppId}:`, error);
      }
    }
    process.removeListener("SIGINT", forceExit);
  });

  beforeEach(() => {
    resetTestTracking();
    testOutputFiles.clear();
    testCommands.length = 0;
  });

  afterEach(async () => {
    await cleanupTrackedResources();
  });

  describe("Push Config Show", () => {
    it(
      "should show push config for a new app (not configured)",
      { timeout: 15000 },
      async () => {
        setupTestFailureHandler("should show push config for a new app");

        if (shouldSkip) return;

        const result = await runCommand(
          ["push:config:show", "--app", testAppId, "--json"],
          {
            env: {
              ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN,
            },
          },
        );

        expect(result.exitCode).toBe(0);
        const output = parseNdjsonLines(result.stdout).find(
          (r) => r.type === "result",
        )!;
        expect(output).toHaveProperty("success", true);
        expect(output).toHaveProperty("appId", testAppId);
        expect(output.apns).toHaveProperty("configured", false);
        expect(output.fcm).toHaveProperty("configured", false);
      },
    );

    it(
      "should show push config in human-readable format",
      { timeout: 15000 },
      async () => {
        setupTestFailureHandler("should show push config human-readable");

        if (shouldSkip) return;

        const result = await runCommand(
          ["push:config:show", "--app", testAppId],
          {
            env: {
              ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN,
            },
          },
        );

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("APNs Configuration");
        expect(result.stdout).toContain("FCM Configuration");
        expect(result.stdout).toContain("Not configured");
      },
    );
  });

  describe("APNs P8 Configuration", () => {
    const p8FixturePath = resolve("test/fixtures/push/test-apns-key.p8");

    it(
      "should configure APNs with P8 key and verify via show",
      { timeout: 30000 },
      async () => {
        setupTestFailureHandler("should configure APNs with P8 key");

        if (shouldSkip) return;

        // 1. Set APNs P8 config
        const setResult = await runCommand(
          [
            "push:config:set-apns",
            "--app",
            testAppId,
            "--key-file",
            p8FixturePath,
            "--key-id",
            "ABC123DEFG",
            "--team-id",
            "TEAM123456",
            "--topic",
            "com.example.pushtest",
            "--sandbox",
            "--json",
          ],
          {
            env: {
              ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN,
            },
          },
        );

        expect(setResult.exitCode).toBe(0);
        const setOutput = parseNdjsonLines(setResult.stdout).find(
          (r) => r.type === "result",
        )!;
        expect(setOutput).toHaveProperty("success", true);
        expect(setOutput).toHaveProperty("method", "p8");

        // 2. Verify config was set by showing it
        const showResult = await runCommand(
          ["push:config:show", "--app", testAppId, "--json"],
          {
            env: {
              ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN,
            },
          },
        );

        expect(showResult.exitCode).toBe(0);
        const showOutput = parseNdjsonLines(showResult.stdout).find(
          (r) => r.type === "result",
        )!;
        expect(showOutput.apns).toHaveProperty("configured", true);
        expect(showOutput.apns).toHaveProperty("hasP8Key", true);
        expect(showOutput.apns).toHaveProperty("useSandbox", true);
        expect(showOutput.apns).toHaveProperty("authType", "token");
        expect(showOutput.apns).toHaveProperty("keyId", "ABC123DEFG");
        expect(showOutput.apns).toHaveProperty("teamId", "TEAM123456");
        expect(showOutput.apns).toHaveProperty(
          "bundleId",
          "com.example.pushtest",
        );
      },
    );

    it("should clear APNs config and verify", { timeout: 30000 }, async () => {
      setupTestFailureHandler("should clear APNs config");

      if (shouldSkip) return;

      // 1. First set APNs config (in case previous test didn't run)
      await runCommand(
        [
          "push:config:set-apns",
          "--app",
          testAppId,
          "--key-file",
          p8FixturePath,
          "--key-id",
          "ABC123DEFG",
          "--team-id",
          "TEAM123456",
          "--topic",
          "com.example.pushtest",
          "--json",
        ],
        {
          env: {
            ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN,
          },
        },
      );

      // 2. Clear APNs config
      const clearResult = await runCommand(
        ["push:config:clear-apns", "--app", testAppId, "--force", "--json"],
        {
          env: {
            ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN,
          },
        },
      );

      expect(clearResult.exitCode).toBe(0);
      const clearOutput = parseNdjsonLines(clearResult.stdout).find(
        (r) => r.type === "result",
      )!;
      expect(clearOutput).toHaveProperty("success", true);
      expect(clearOutput).toHaveProperty("cleared", "apns");

      // 3. Verify config was cleared
      const showResult = await runCommand(
        ["push:config:show", "--app", testAppId, "--json"],
        {
          env: {
            ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN,
          },
        },
      );

      expect(showResult.exitCode).toBe(0);
      const showOutput = parseNdjsonLines(showResult.stdout).find(
        (r) => r.type === "result",
      )!;
      expect(showOutput.apns).toHaveProperty("configured", false);
      expect(showOutput.apns).toHaveProperty("hasP8Key", false);
    });
  });

  describe("FCM Configuration", () => {
    const fcmFixturePath = resolve(
      "test/fixtures/push/test-fcm-service-account.json",
    );

    it(
      "should configure FCM and verify via show",
      { timeout: 30000 },
      async () => {
        setupTestFailureHandler("should configure FCM");

        if (shouldSkip) return;

        // 1. Set FCM config
        const setResult = await runCommand(
          [
            "push:config:set-fcm",
            "--app",
            testAppId,
            "--service-account",
            fcmFixturePath,
            "--json",
          ],
          {
            env: {
              ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN,
            },
          },
        );

        expect(setResult.exitCode).toBe(0);
        const setOutput = parseNdjsonLines(setResult.stdout).find(
          (r) => r.type === "result",
        )!;
        expect(setOutput).toHaveProperty("success", true);

        // 2. Verify config was set
        const showResult = await runCommand(
          ["push:config:show", "--app", testAppId, "--json"],
          {
            env: {
              ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN,
            },
          },
        );

        expect(showResult.exitCode).toBe(0);
        const showOutput = parseNdjsonLines(showResult.stdout).find(
          (r) => r.type === "result",
        )!;
        expect(showOutput.fcm).toHaveProperty("configured", true);
      },
    );

    it("should clear FCM config and verify", { timeout: 30000 }, async () => {
      setupTestFailureHandler("should clear FCM config");

      if (shouldSkip) return;

      // 1. First set FCM config
      await runCommand(
        [
          "push:config:set-fcm",
          "--app",
          testAppId,
          "--service-account",
          fcmFixturePath,
          "--json",
        ],
        {
          env: {
            ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN,
          },
        },
      );

      // 2. Clear FCM config
      const clearResult = await runCommand(
        ["push:config:clear-fcm", "--app", testAppId, "--force", "--json"],
        {
          env: {
            ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN,
          },
        },
      );

      expect(clearResult.exitCode).toBe(0);
      const clearOutput = parseNdjsonLines(clearResult.stdout).find(
        (r) => r.type === "result",
      )!;
      expect(clearOutput).toHaveProperty("success", true);
      expect(clearOutput).toHaveProperty("cleared", "fcm");

      // 3. Verify config was cleared
      const showResult = await runCommand(
        ["push:config:show", "--app", testAppId, "--json"],
        {
          env: {
            ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN,
          },
        },
      );

      expect(showResult.exitCode).toBe(0);
      const showOutput = parseNdjsonLines(showResult.stdout).find(
        (r) => r.type === "result",
      )!;
      expect(showOutput.fcm).toHaveProperty("configured", false);
    });
  });

  describe("Validation", () => {
    it(
      "should reject set-apns without required P8 flags",
      { timeout: 15000 },
      async () => {
        setupTestFailureHandler("should reject set-apns without P8 flags");

        if (shouldSkip) return;

        const p8FixturePath = resolve("test/fixtures/push/test-apns-key.p8");

        // Missing --key-id, --team-id, --topic
        const result = await runCommand(
          [
            "push:config:set-apns",
            "--app",
            testAppId,
            "--key-file",
            p8FixturePath,
          ],
          {
            env: {
              ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN,
            },
          },
        );

        expect(result.exitCode).not.toBe(0);
      },
    );

    it(
      "should reject set-apns without any certificate or key",
      { timeout: 15000 },
      async () => {
        setupTestFailureHandler("should reject set-apns without cert or key");

        if (shouldSkip) return;

        const result = await runCommand(
          ["push:config:set-apns", "--app", testAppId],
          {
            env: {
              ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN,
            },
          },
        );

        expect(result.exitCode).not.toBe(0);
      },
    );

    it(
      "should reject set-fcm with invalid JSON file",
      { timeout: 15000 },
      async () => {
        setupTestFailureHandler("should reject set-fcm with invalid JSON");

        if (shouldSkip) return;

        const p8FixturePath = resolve("test/fixtures/push/test-apns-key.p8");

        const result = await runCommand(
          [
            "push:config:set-fcm",
            "--app",
            testAppId,
            "--service-account",
            p8FixturePath,
          ],
          {
            env: {
              ABLY_ACCESS_TOKEN: process.env.E2E_ABLY_ACCESS_TOKEN,
            },
          },
        );

        expect(result.exitCode).not.toBe(0);
      },
    );
  });
});
