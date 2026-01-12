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

describe.skipIf(SHOULD_SKIP_E2E)("Push Channel Subscriptions E2E Tests", () => {
  let testDeviceIdBase: string;
  let client: Ably.Rest;
  let testDeviceId: string;

  beforeAll(async () => {
    process.on("SIGINT", forceExit);

    // Generate unique device ID base for this test run
    testDeviceIdBase = `cli-e2e-channel-test-${Date.now()}`;
    testDeviceId = `${testDeviceIdBase}-device`;

    // Create Ably client for verification
    client = createAblyClient();

    // Create a test device for subscription tests
    await client.push.admin.deviceRegistrations.save({
      id: testDeviceId,
      platform: "android",
      formFactor: "phone",
      clientId: "e2e-channel-test-user",
      push: {
        recipient: {
          transportType: "fcm",
          registrationToken: `fake-fcm-channel-test-${Date.now()}`,
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

  describe("push channels save - validation", () => {
    it("should error when neither device-id nor client-id provided", async () => {
      const result = await runCommand(
        ["push", "channels", "save", "--channel", "test-channel"],
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
          "channels",
          "save",
          "--channel",
          "test-channel",
          "--device-id",
          "device1",
          "--recipient-client-id",
          "client1",
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
  });

  describe("push channels list - validation", () => {
    it("should require --channel flag", async () => {
      const result = await runCommand(["push", "channels", "list"], {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 30000,
      });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Missing required flag channel");
    });
  });

  describe("push channels list-channels", () => {
    it("should list channels (may be empty if no push subscriptions)", async () => {
      const result = await runCommand(["push", "channels", "list-channels"], {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 30000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Channels with Push Subscriptions");
    });

    it("should output JSON when --json flag is used", async () => {
      const result = await runCommand(
        ["push", "channels", "list-channels", "--json"],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(result.exitCode).toBe(0);

      const json = JSON.parse(result.stdout);
      expect(json.success).toBe(true);
      expect(json.channels).toBeInstanceOf(Array);
    });
  });

  describe("push channels remove - validation", () => {
    it("should error when neither device-id nor client-id provided", async () => {
      const result = await runCommand(
        ["push", "channels", "remove", "--channel", "test-channel", "--force"],
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
  });

  describe("push channels remove-where - validation", () => {
    it("should require at least one filter criterion", async () => {
      const result = await runCommand(
        [
          "push",
          "channels",
          "remove-where",
          "--channel",
          "test-channel",
          "--force",
        ],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("At least one filter criterion");
    });
  });

  // Note: Tests that require push-enabled channels are not included here
  // because the test environment doesn't have push configured for channels.
  // The validation tests above verify the CLI command structure is correct.
  // Full integration tests would require a push-enabled namespace configuration.
});
