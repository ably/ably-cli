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

describe("Push Devices E2E Tests", () => {
  // Skip all tests if API key not available
  let testDeviceIdBase: string;
  let client: Ably.Rest;

  beforeAll(async () => {
    if (SHOULD_SKIP_E2E) {
      return;
    }

    process.on("SIGINT", forceExit);

    // Generate unique device ID base for this test run
    testDeviceIdBase = `cli-e2e-test-${Date.now()}`;

    // Create Ably client for verification
    client = createAblyClient();
  });

  afterAll(() => {
    process.removeListener("SIGINT", forceExit);
  });

  beforeEach(() => {
    // Clear tracked commands and output files before each test
    resetTestTracking();
  });

  afterEach(async () => {
    // Set up failure handler for debug output
    setupTestFailureHandler();
    await cleanupTrackedResources();
  });

  describe("push devices save", () => {
    it.skipIf(SHOULD_SKIP_E2E)(
      "should register an Android device with FCM token",
      async () => {
        const deviceId = `${testDeviceIdBase}-android-save`;
        const fakeToken = `fake-fcm-token-${Date.now()}`;

        const result = await runCommand(
          [
            "push",
            "devices",
            "save",
            "--id",
            deviceId,
            "--platform",
            "android",
            "--form-factor",
            "phone",
            "--transport-type",
            "fcm",
            "--device-token",
            fakeToken,
            "--recipient-client-id",
            "e2e-test-user",
          ],
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Device registered successfully");
        expect(result.stdout).toContain(deviceId);
        expect(result.stdout).toContain("android");

        // Verify with SDK
        const device =
          await client.push.admin.deviceRegistrations.get(deviceId);
        expect(device.id).toBe(deviceId);
        expect(device.platform).toBe("android");
        expect(device.formFactor).toBe("phone");
        expect(device.clientId).toBe("e2e-test-user");

        // Cleanup
        await client.push.admin.deviceRegistrations.remove(deviceId);
      },
    );

    it.skipIf(SHOULD_SKIP_E2E)(
      "should register an iOS device with APNs token",
      async () => {
        const deviceId = `${testDeviceIdBase}-ios-save`;
        const fakeToken = `fake-apns-token-${Date.now()}`;

        const result = await runCommand(
          [
            "push",
            "devices",
            "save",
            "--id",
            deviceId,
            "--platform",
            "ios",
            "--form-factor",
            "tablet",
            "--transport-type",
            "apns",
            "--device-token",
            fakeToken,
          ],
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Device registered successfully");
        expect(result.stdout).toContain("ios");
        expect(result.stdout).toContain("tablet");

        // Cleanup
        await client.push.admin.deviceRegistrations.remove(deviceId);
      },
    );

    it.skipIf(SHOULD_SKIP_E2E)(
      "should output JSON when --json flag is used",
      async () => {
        const deviceId = `${testDeviceIdBase}-json-save`;
        const fakeToken = `fake-fcm-token-json-${Date.now()}`;

        const result = await runCommand(
          [
            "push",
            "devices",
            "save",
            "--id",
            deviceId,
            "--platform",
            "android",
            "--form-factor",
            "phone",
            "--transport-type",
            "fcm",
            "--device-token",
            fakeToken,
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
        expect(json.device).toBeDefined();
        expect(json.device.id).toBe(deviceId);
        expect(json.device.platform).toBe("android");

        // Cleanup
        await client.push.admin.deviceRegistrations.remove(deviceId);
      },
    );
  });

  describe("push devices get", () => {
    let testDeviceId: string;

    beforeAll(async () => {
      if (SHOULD_SKIP_E2E) return;

      // Create a test device for get tests
      testDeviceId = `${testDeviceIdBase}-get-test`;
      await client.push.admin.deviceRegistrations.save({
        id: testDeviceId,
        platform: "android",
        formFactor: "phone",
        clientId: "e2e-get-test-user",
        push: {
          recipient: {
            transportType: "fcm",
            registrationToken: `fake-token-get-${Date.now()}`,
          },
        },
      });
    });

    afterAll(async () => {
      if (SHOULD_SKIP_E2E) return;

      // Cleanup test device
      try {
        await client.push.admin.deviceRegistrations.remove(testDeviceId);
      } catch {
        // Ignore cleanup errors
      }
    });

    it.skipIf(SHOULD_SKIP_E2E)("should get device details by ID", async () => {
      const result = await runCommand(
        ["push", "devices", "get", testDeviceId],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Device Details");
      expect(result.stdout).toContain(testDeviceId);
      expect(result.stdout).toContain("android");
      expect(result.stdout).toContain("phone");
      expect(result.stdout).toContain("e2e-get-test-user");
    });

    it.skipIf(SHOULD_SKIP_E2E)(
      "should output JSON when --json flag is used",
      async () => {
        const result = await runCommand(
          ["push", "devices", "get", testDeviceId, "--json"],
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );

        expect(result.exitCode).toBe(0);

        const json = JSON.parse(result.stdout);
        expect(json.success).toBe(true);
        expect(json.device).toBeDefined();
        expect(json.device.id).toBe(testDeviceId);
        expect(json.device.platform).toBe("android");
        expect(json.device.clientId).toBe("e2e-get-test-user");
      },
    );

    it.skipIf(SHOULD_SKIP_E2E)(
      "should handle non-existent device",
      async () => {
        const result = await runCommand(
          ["push", "devices", "get", "non-existent-device-12345"],
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );

        // Command should fail with non-zero exit code
        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toContain("not found");
      },
    );
  });

  describe("push devices list", () => {
    const listTestDevices: string[] = [];

    beforeAll(async () => {
      if (SHOULD_SKIP_E2E) return;

      // Create multiple test devices for list tests
      for (let i = 0; i < 3; i++) {
        const deviceId = `${testDeviceIdBase}-list-${i}`;
        listTestDevices.push(deviceId);

        await client.push.admin.deviceRegistrations.save({
          id: deviceId,
          platform: i % 2 === 0 ? "android" : "ios",
          formFactor: "phone",
          clientId: "e2e-list-test-user",
          push: {
            recipient: {
              transportType: i % 2 === 0 ? "fcm" : "apns",
              ...(i % 2 === 0
                ? { registrationToken: `fake-fcm-list-${i}-${Date.now()}` }
                : { deviceToken: `fake-apns-list-${i}-${Date.now()}` }),
            },
          },
        });
      }
    });

    afterAll(async () => {
      if (SHOULD_SKIP_E2E) return;

      // Cleanup test devices
      for (const deviceId of listTestDevices) {
        try {
          await client.push.admin.deviceRegistrations.remove(deviceId);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it.skipIf(SHOULD_SKIP_E2E)("should list devices", async () => {
      const result = await runCommand(["push", "devices", "list"], {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 30000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Found");
      expect(result.stdout).toContain("device");
    });

    it.skipIf(SHOULD_SKIP_E2E)("should filter by client ID", async () => {
      const result = await runCommand(
        [
          "push",
          "devices",
          "list",
          "--recipient-client-id",
          "e2e-list-test-user",
        ],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(result.exitCode).toBe(0);
      // All our test devices have this client ID
      for (const deviceId of listTestDevices) {
        expect(result.stdout).toContain(deviceId);
      }
    });

    it.skipIf(SHOULD_SKIP_E2E)(
      "should output JSON when --json flag is used",
      async () => {
        const result = await runCommand(
          [
            "push",
            "devices",
            "list",
            "--recipient-client-id",
            "e2e-list-test-user",
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
        expect(json.devices).toBeInstanceOf(Array);
        expect(json.devices.length).toBeGreaterThanOrEqual(3);
      },
    );

    it.skipIf(SHOULD_SKIP_E2E)("should respect --limit flag", async () => {
      const result = await runCommand(
        [
          "push",
          "devices",
          "list",
          "--recipient-client-id",
          "e2e-list-test-user",
          "--limit",
          "2",
          "--json",
        ],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(result.exitCode).toBe(0);

      const json = JSON.parse(result.stdout);
      expect(json.devices.length).toBeLessThanOrEqual(2);
    });
  });

  describe("push devices remove", () => {
    it.skipIf(SHOULD_SKIP_E2E)("should remove a device by ID", async () => {
      const deviceId = `${testDeviceIdBase}-remove-test`;

      // First create a device
      await client.push.admin.deviceRegistrations.save({
        id: deviceId,
        platform: "android",
        formFactor: "phone",
        push: {
          recipient: {
            transportType: "fcm",
            registrationToken: `fake-remove-${Date.now()}`,
          },
        },
      });

      // Remove using CLI with --force to skip confirmation
      const result = await runCommand(
        ["push", "devices", "remove", deviceId, "--force"],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("removed successfully");
      expect(result.stdout).toContain(deviceId);

      // Verify device is gone
      await expect(
        client.push.admin.deviceRegistrations.get(deviceId),
      ).rejects.toMatchObject({ code: 40400 });
    });

    it.skipIf(SHOULD_SKIP_E2E)(
      "should output JSON when --json flag is used",
      async () => {
        const deviceId = `${testDeviceIdBase}-remove-json`;

        // First create a device
        await client.push.admin.deviceRegistrations.save({
          id: deviceId,
          platform: "ios",
          formFactor: "phone",
          push: {
            recipient: {
              transportType: "apns",
              deviceToken: `fake-remove-json-${Date.now()}`,
            },
          },
        });

        const result = await runCommand(
          ["push", "devices", "remove", deviceId, "--force", "--json"],
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );

        expect(result.exitCode).toBe(0);

        const json = JSON.parse(result.stdout);
        expect(json.success).toBe(true);
        expect(json.removed).toBe(true);
        expect(json.deviceId).toBe(deviceId);
      },
    );
  });

  describe("push devices remove-where", () => {
    it.skipIf(SHOULD_SKIP_E2E)(
      "should remove devices by client ID",
      async () => {
        const clientIdForRemoval = `e2e-remove-where-${Date.now()}`;
        const deviceIds: string[] = [];

        // Create multiple devices with same client ID
        for (let i = 0; i < 2; i++) {
          const deviceId = `${testDeviceIdBase}-remove-where-${i}`;
          deviceIds.push(deviceId);

          await client.push.admin.deviceRegistrations.save({
            id: deviceId,
            platform: "android",
            formFactor: "phone",
            clientId: clientIdForRemoval,
            push: {
              recipient: {
                transportType: "fcm",
                registrationToken: `fake-remove-where-${i}-${Date.now()}`,
              },
            },
          });
        }

        // Remove using CLI
        const result = await runCommand(
          [
            "push",
            "devices",
            "remove-where",
            "--recipient-client-id",
            clientIdForRemoval,
            "--force",
          ],
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("removed successfully");

        // Verify all devices are gone
        for (const deviceId of deviceIds) {
          await expect(
            client.push.admin.deviceRegistrations.get(deviceId),
          ).rejects.toMatchObject({ code: 40400 });
        }
      },
    );

    it.skipIf(SHOULD_SKIP_E2E)(
      "should require at least one filter criterion",
      async () => {
        const result = await runCommand(
          ["push", "devices", "remove-where", "--force"],
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );

        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toContain(
          "At least one filter criterion is required",
        );
      },
    );
  });
});
