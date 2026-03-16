import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("push:devices:save command", () => {
  beforeEach(() => {
    getMockAblyRest();
  });

  standardHelpTests("push:devices:save", import.meta.url);
  standardArgValidationTests("push:devices:save", import.meta.url);
  standardFlagTests("push:devices:save", import.meta.url, [
    "--json",
    "--id",
    "--platform",
    "--form-factor",
    "--transport-type",
    "--device-token",
    "--target-url",
    "--p256dh-key",
    "--auth-secret",
  ]);

  describe("functionality", () => {
    it("should save a device with inline flags", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.save.mockResolvedValue({
        id: "device-1",
        platform: "ios",
      });

      const { stdout } = await runCommand(
        [
          "push:devices:save",
          "--id",
          "device-1",
          "--platform",
          "ios",
          "--form-factor",
          "phone",
          "--transport-type",
          "apns",
          "--device-token",
          "token123",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Device registration saved");
      expect(mock.push.admin.deviceRegistrations.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "device-1",
          platform: "ios",
          formFactor: "phone",
        }),
      );
    });

    it("should save a device with --data JSON", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.save.mockResolvedValue({
        id: "device-2",
      });

      const { stdout } = await runCommand(
        [
          "push:devices:save",
          "--data",
          '{"id":"device-2","platform":"android","formFactor":"tablet","push":{"recipient":{"transportType":"fcm","registrationToken":"tok"}}}',
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Device registration saved");
    });

    it("should output JSON when requested", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.save.mockResolvedValue({
        id: "device-1",
      });

      const { stdout } = await runCommand(
        [
          "push:devices:save",
          "--id",
          "device-1",
          "--platform",
          "ios",
          "--form-factor",
          "phone",
          "--transport-type",
          "apns",
          "--device-token",
          "token123",
          "--json",
        ],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("device");
    });

    it("should save a web push device with inline flags", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.save.mockResolvedValue({
        id: "browser-1",
        platform: "browser",
      });

      const { stdout } = await runCommand(
        [
          "push:devices:save",
          "--id",
          "browser-1",
          "--platform",
          "browser",
          "--form-factor",
          "desktop",
          "--transport-type",
          "web",
          "--target-url",
          "https://push.example.com",
          "--p256dh-key",
          "BNcRdreALRFX...",
          "--auth-secret",
          "tBHItJI5svbpC...",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Device registration saved");
      expect(mock.push.admin.deviceRegistrations.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "browser-1",
          platform: "browser",
          formFactor: "desktop",
          push: {
            recipient: {
              transportType: "web",
              targetUrl: "https://push.example.com",
              encryptionKey: {
                p256dh: "BNcRdreALRFX...",
                auth: "tBHItJI5svbpC...",
              },
            },
          },
        }),
      );
    });
  });

  describe("argument validation", () => {
    it("should require web push flags for web transport", async () => {
      const { error } = await runCommand(
        [
          "push:devices:save",
          "--id",
          "browser-1",
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
    });

    it("should require --device-token for apns transport", async () => {
      const { error } = await runCommand(
        [
          "push:devices:save",
          "--id",
          "device-1",
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
    });

    it("should require --id when not using --data", async () => {
      const { error } = await runCommand(
        [
          "push:devices:save",
          "--platform",
          "ios",
          "--form-factor",
          "phone",
          "--transport-type",
          "apns",
          "--device-token",
          "token123",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.save.mockRejectedValue(
        new Error("Save failed"),
      );

      const { error } = await runCommand(
        [
          "push:devices:save",
          "--id",
          "device-1",
          "--platform",
          "ios",
          "--form-factor",
          "phone",
          "--transport-type",
          "apns",
          "--device-token",
          "token123",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should handle invalid JSON in --data", async () => {
      const { error } = await runCommand(
        ["push:devices:save", "--data", "not-json"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should reject non-object --metadata (string)", async () => {
      const { error } = await runCommand(
        [
          "push:devices:save",
          "--id",
          "device-1",
          "--platform",
          "ios",
          "--form-factor",
          "phone",
          "--transport-type",
          "apns",
          "--device-token",
          "token123",
          "--metadata",
          "42",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("must be a JSON object");
    });

    it("should reject non-object --metadata (array)", async () => {
      const { error } = await runCommand(
        [
          "push:devices:save",
          "--id",
          "device-1",
          "--platform",
          "ios",
          "--form-factor",
          "phone",
          "--transport-type",
          "apns",
          "--device-token",
          "token123",
          "--metadata",
          "[1,2,3]",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("must be a JSON object");
    });
  });
});
