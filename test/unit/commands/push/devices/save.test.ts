import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../../helpers/mock-ably-rest.js";

describe("push:devices:save command", () => {
  beforeEach(() => {
    const mock = getMockAblyRest();
    mock.push.admin.deviceRegistrations.save.mockReset();
    mock.push.admin.deviceRegistrations.save.mockResolvedValue({
      id: "test-device-id",
      platform: "android",
      formFactor: "phone",
      push: {
        state: "ACTIVE",
        recipient: {
          transportType: "fcm",
          registrationToken: "fake-fcm-token",
        },
      },
    });
  });

  describe("successful registration", () => {
    it("should register an Android device with FCM", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        [
          "push:devices:save",
          "--id",
          "test-device-id",
          "--platform",
          "android",
          "--form-factor",
          "phone",
          "--transport-type",
          "fcm",
          "--device-token",
          "fake-fcm-token",
        ],
        import.meta.url,
      );

      expect(mock.push.admin.deviceRegistrations.save).toHaveBeenCalledOnce();
      expect(stdout).toContain("Device registered successfully");
      expect(stdout).toContain("test-device-id");
    });

    it("should register an iOS device with APNs", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.save.mockResolvedValue({
        id: "ios-device-id",
        platform: "ios",
        formFactor: "tablet",
        push: {
          state: "ACTIVE",
          recipient: {
            transportType: "apns",
            deviceToken: "fake-apns-token",
          },
        },
      });

      const { stdout } = await runCommand(
        [
          "push:devices:save",
          "--id",
          "ios-device-id",
          "--platform",
          "ios",
          "--form-factor",
          "tablet",
          "--transport-type",
          "apns",
          "--device-token",
          "fake-apns-token",
        ],
        import.meta.url,
      );

      expect(mock.push.admin.deviceRegistrations.save).toHaveBeenCalledOnce();
      expect(stdout).toContain("Device registered successfully");
      expect(stdout).toContain("ios-device-id");
    });

    it("should register a browser device with web push", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.save.mockResolvedValue({
        id: "web-device-id",
        platform: "browser",
        formFactor: "desktop",
        push: {
          state: "ACTIVE",
          recipient: {
            transportType: "web",
            targetUrl: "https://example.com/push",
            encryptionKey: {
              p256dh: "test-p256dh",
              auth: "test-auth",
            },
          },
        },
      });

      const { stdout } = await runCommand(
        [
          "push:devices:save",
          "--id",
          "web-device-id",
          "--platform",
          "browser",
          "--form-factor",
          "desktop",
          "--transport-type",
          "web",
          "--target-url",
          "https://example.com/push",
          "--p256dh-key",
          "test-p256dh",
          "--auth-secret",
          "test-auth",
        ],
        import.meta.url,
      );

      expect(mock.push.admin.deviceRegistrations.save).toHaveBeenCalledOnce();
      expect(stdout).toContain("Device registered successfully");
      expect(stdout).toContain("web-device-id");
    });

    it("should output JSON when --json flag is used", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        [
          "push:devices:save",
          "--id",
          "test-device-id",
          "--platform",
          "android",
          "--form-factor",
          "phone",
          "--transport-type",
          "fcm",
          "--device-token",
          "fake-fcm-token",
          "--json",
        ],
        import.meta.url,
      );

      const output = JSON.parse(stdout);
      expect(output.success).toBe(true);
      expect(output.device).toBeDefined();
      expect(output.device.id).toBe("test-device-id");
      expect(mock.push.admin.deviceRegistrations.save).toHaveBeenCalledOnce();
    });

    it("should include client ID when provided", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.save.mockResolvedValue({
        id: "test-device-id",
        clientId: "test-client",
        platform: "android",
        formFactor: "phone",
        push: {
          state: "ACTIVE",
          recipient: {
            transportType: "fcm",
            registrationToken: "fake-fcm-token",
          },
        },
      });

      const { stdout } = await runCommand(
        [
          "push:devices:save",
          "--id",
          "test-device-id",
          "--platform",
          "android",
          "--form-factor",
          "phone",
          "--transport-type",
          "fcm",
          "--device-token",
          "fake-fcm-token",
          "--recipient-client-id",
          "test-client",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Client ID");
      expect(stdout).toContain("test-client");
    });
  });

  describe("validation errors", () => {
    it("should require --device-token for FCM transport", async () => {
      const { error } = await runCommand(
        [
          "push:devices:save",
          "--id",
          "test-device",
          "--platform",
          "android",
          "--form-factor",
          "phone",
          "--transport-type",
          "fcm",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/device-token.*required/i);
    });

    it("should require --device-token for APNs transport", async () => {
      const { error } = await runCommand(
        [
          "push:devices:save",
          "--id",
          "test-device",
          "--platform",
          "ios",
          "--form-factor",
          "phone",
          "--transport-type",
          "apns",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/device-token.*required/i);
    });

    it("should require --target-url for web transport", async () => {
      const { error } = await runCommand(
        [
          "push:devices:save",
          "--id",
          "test-device",
          "--platform",
          "browser",
          "--form-factor",
          "desktop",
          "--transport-type",
          "web",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/target-url.*required/i);
    });

    it("should require --id flag", async () => {
      const { error } = await runCommand(
        [
          "push:devices:save",
          "--platform",
          "android",
          "--form-factor",
          "phone",
          "--transport-type",
          "fcm",
          "--device-token",
          "fake-token",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/--id.*required/i);
    });
  });

  describe("error handling", () => {
    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.save.mockRejectedValue(
        new Error("API Error: Device registration failed"),
      );

      const { error } = await runCommand(
        [
          "push:devices:save",
          "--id",
          "test-device-id",
          "--platform",
          "android",
          "--form-factor",
          "phone",
          "--transport-type",
          "fcm",
          "--device-token",
          "fake-fcm-token",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/error/i);
    });

    it("should handle network errors", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.save.mockRejectedValue(
        new Error("Network error"),
      );

      const { error } = await runCommand(
        [
          "push:devices:save",
          "--id",
          "test-device-id",
          "--platform",
          "android",
          "--form-factor",
          "phone",
          "--transport-type",
          "fcm",
          "--device-token",
          "fake-fcm-token",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/network/i);
    });
  });
});
