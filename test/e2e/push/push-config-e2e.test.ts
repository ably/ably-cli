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
  cleanupTrackedResources,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import { runCommand } from "../../helpers/command-helpers.js";
import { createTestApp } from "../../helpers/e2e-test-app.js";
import { parseNdjsonLines } from "../../helpers/ndjson.js";
import { resolve } from "node:path";

describe("Push Config E2E Tests", () => {
  let testAppId: string;
  let teardownApp: (() => Promise<void>) | undefined;
  let shouldSkip = false;

  beforeAll(async () => {
    if (!process.env.E2E_ABLY_ACCESS_TOKEN) {
      console.log(
        "E2E_ABLY_ACCESS_TOKEN not available, skipping Push Config E2E tests",
      );
      shouldSkip = true;
      return;
    }

    ({ appId: testAppId, teardown: teardownApp } = await createTestApp(
      "e2e-push-config-test",
    ));
  });

  afterAll(async () => {
    await teardownApp?.();
  });

  beforeEach(() => {
    resetTestTracking();
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
        const config = output.config as Record<string, unknown>;
        expect(config).toHaveProperty("appId", testAppId);
        expect(config.apns as Record<string, unknown>).toHaveProperty(
          "configured",
          false,
        );
        expect(config.fcm as Record<string, unknown>).toHaveProperty(
          "configured",
          false,
        );
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
        const setConfig = setOutput.config as Record<string, unknown>;
        expect(setConfig).toHaveProperty("method", "p8");

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
        const showConfig = showOutput.config as Record<string, unknown>;
        const apns = showConfig.apns as Record<string, unknown>;
        expect(apns).toHaveProperty("configured", true);
        expect(apns).toHaveProperty("hasP8Key", true);
        expect(apns).toHaveProperty("useSandbox", true);
        expect(apns).toHaveProperty("authType", "token");
        expect(apns).toHaveProperty("keyId", "ABC123DEFG");
        expect(apns).toHaveProperty("teamId", "TEAM123456");
        expect(apns).toHaveProperty("bundleId", "com.example.pushtest");
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
      const clearConfig = clearOutput.config as Record<string, unknown>;
      expect(clearConfig).toHaveProperty("cleared", "apns");

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
      const showConfig = showOutput.config as Record<string, unknown>;
      const apns = showConfig.apns as Record<string, unknown>;
      expect(apns).toHaveProperty("configured", false);
      expect(apns).toHaveProperty("hasP8Key", false);
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
        const showConfig = showOutput.config as Record<string, unknown>;
        expect(showConfig.fcm as Record<string, unknown>).toHaveProperty(
          "configured",
          true,
        );
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
      const clearConfig = clearOutput.config as Record<string, unknown>;
      expect(clearConfig).toHaveProperty("cleared", "fcm");

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
      const showConfig = showOutput.config as Record<string, unknown>;
      expect(showConfig.fcm as Record<string, unknown>).toHaveProperty(
        "configured",
        false,
      );
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
