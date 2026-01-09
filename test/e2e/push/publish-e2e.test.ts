import {
  describe,
  it,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  expect,
} from "vitest";
import * as Ably from "ably";
import {
  E2E_API_KEY,
  SHOULD_SKIP_E2E,
  forceExit,
  cleanupTrackedResources,
  setupTestFailureHandler,
  resetTestTracking,
  createAblyClient,
} from "../../helpers/e2e-test-helper.js";
import { runCommand } from "../../helpers/command-helpers.js";

describe.skipIf(SHOULD_SKIP_E2E)("Push Publish E2E Tests", () => {
  let testDeviceId: string;
  let client: Ably.Rest;

  beforeAll(async () => {
    process.on("SIGINT", forceExit);

    // Generate unique device ID for this test run
    testDeviceId = `cli-e2e-publish-test-${Date.now()}`;

    // Create Ably client
    client = createAblyClient();

    // Create a test device for publish tests
    await client.push.admin.deviceRegistrations.save({
      id: testDeviceId,
      platform: "android",
      formFactor: "phone",
      clientId: "e2e-publish-test-user",
      push: {
        recipient: {
          transportType: "fcm",
          registrationToken: `fake-fcm-publish-test-${Date.now()}`,
        },
      },
    });
  });

  afterAll(async () => {
    // Cleanup test device
    try {
      await client.push.admin.deviceRegistrations.remove(testDeviceId);
    } catch {
      // Ignore cleanup errors
    }

    process.removeListener("SIGINT", forceExit);
  });

  beforeEach(() => {
    resetTestTracking();
  });

  afterEach(async () => {
    setupTestFailureHandler();
    await cleanupTrackedResources();
  });

  describe("push publish", () => {
    it("should publish a simple notification to a device", async () => {
      const result = await runCommand(
        [
          "push",
          "publish",
          "--device-id",
          testDeviceId,
          "--title",
          "Test Title",
          "--body",
          "Test Body",
        ],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("sent successfully");
      expect(result.stdout).toContain(testDeviceId);
    });

    it("should publish with JSON output", async () => {
      const result = await runCommand(
        [
          "push",
          "publish",
          "--device-id",
          testDeviceId,
          "--title",
          "JSON Test",
          "--body",
          "Testing JSON output",
          "--json",
        ],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(result.exitCode).toBe(0);

      const json = JSON.parse(result.stdout);
      expect(json.success).toBe(true);
      expect(json.published).toBe(true);
      expect(json.recipient.deviceId).toBe(testDeviceId);
    });

    it("should publish with custom data payload", async () => {
      const result = await runCommand(
        [
          "push",
          "publish",
          "--device-id",
          testDeviceId,
          "--title",
          "Data Test",
          "--body",
          "With custom data",
          "--data",
          '{"orderId":"12345","action":"view"}',
        ],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("sent successfully");
    });

    it("should publish with full payload", async () => {
      const payload = JSON.stringify({
        notification: {
          title: "Full Payload Test",
          body: "Testing full payload",
        },
        data: {
          key: "value",
        },
      });

      const result = await runCommand(
        ["push", "publish", "--device-id", testDeviceId, "--payload", payload],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("sent successfully");
    });

    it("should publish to a client ID", async () => {
      const result = await runCommand(
        [
          "push",
          "publish",
          "--recipient-client-id",
          "e2e-publish-test-user",
          "--title",
          "Client Test",
          "--body",
          "To client",
        ],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("sent successfully");
      expect(result.stdout).toContain("e2e-publish-test-user");
    });

    it("should error when neither device-id nor client-id provided", async () => {
      const result = await runCommand(
        ["push", "publish", "--title", "Test", "--body", "Test"],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain(
        "Either --device-id or --recipient-client-id must be specified",
      );
    });

    it("should error when both device-id and client-id provided", async () => {
      const result = await runCommand(
        [
          "push",
          "publish",
          "--device-id",
          "device1",
          "--recipient-client-id",
          "client1",
          "--title",
          "Test",
        ],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain(
        "Only one of --device-id or --recipient-client-id can be specified",
      );
    });

    it("should error when no payload or title/body provided", async () => {
      const result = await runCommand(
        ["push", "publish", "--device-id", testDeviceId],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("--payload");
    });

    it("should error when payload and title both provided", async () => {
      const result = await runCommand(
        [
          "push",
          "publish",
          "--device-id",
          testDeviceId,
          "--payload",
          '{"notification":{"title":"Test"}}',
          "--title",
          "Conflict",
        ],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Cannot use --payload with --title");
    });
  });

  describe("push batch-publish", () => {
    it("should batch publish notifications", async () => {
      const batchPayload = JSON.stringify([
        {
          recipient: { deviceId: testDeviceId },
          payload: { notification: { title: "Batch 1", body: "First" } },
        },
        {
          recipient: { deviceId: testDeviceId },
          payload: { notification: { title: "Batch 2", body: "Second" } },
        },
      ]);

      const result = await runCommand(
        ["push", "batch-publish", "--payload", batchPayload],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Batch Push Results");
      expect(result.stdout).toContain("Total:");
      expect(result.stdout).toContain("2");
    });

    it("should batch publish with JSON output", async () => {
      const batchPayload = JSON.stringify([
        {
          recipient: { deviceId: testDeviceId },
          payload: { notification: { title: "JSON Batch", body: "Test" } },
        },
      ]);

      const result = await runCommand(
        ["push", "batch-publish", "--payload", batchPayload, "--json"],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(result.exitCode).toBe(0);

      const json = JSON.parse(result.stdout);
      expect(json.total).toBe(1);
      expect(json.results).toBeInstanceOf(Array);
    });

    it("should error with invalid batch payload format", async () => {
      const result = await runCommand(
        ["push", "batch-publish", "--payload", '{"not":"an array"}'],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(result.exitCode).not.toBe(0);
      // Check for part of the error message (full message may wrap across lines)
      expect(result.stderr).toContain("must be a JSON");
    });

    it("should error with empty batch payload", async () => {
      const result = await runCommand(
        ["push", "batch-publish", "--payload", "[]"],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("empty");
    });

    it("should error with missing recipient in batch item", async () => {
      const batchPayload = JSON.stringify([
        { payload: { notification: { title: "No recipient" } } },
      ]);

      const result = await runCommand(
        ["push", "batch-publish", "--payload", batchPayload],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("recipient");
    });
  });
});
