import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../../helpers/mock-ably-rest.js";

describe("push:devices:get command", () => {
  beforeEach(() => {
    const mock = getMockAblyRest();
    mock.push.admin.deviceRegistrations.get.mockReset();
    mock.push.admin.deviceRegistrations.get.mockResolvedValue({
      id: "test-device-id",
      platform: "android",
      formFactor: "phone",
      clientId: "test-client",
      push: {
        state: "ACTIVE",
        recipient: {
          transportType: "fcm",
          registrationToken: "fake-fcm-token-12345",
        },
      },
    });
  });

  describe("successful retrieval", () => {
    it("should get device details by ID", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        ["push:devices:get", "test-device-id"],
        import.meta.url,
      );

      expect(mock.push.admin.deviceRegistrations.get).toHaveBeenCalledWith(
        "test-device-id",
      );
      expect(stdout).toContain("test-device-id");
      expect(stdout).toContain("android");
      expect(stdout).toContain("phone");
    });

    it("should display client ID when present", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        ["push:devices:get", "test-device-id"],
        import.meta.url,
      );

      expect(mock.push.admin.deviceRegistrations.get).toHaveBeenCalledOnce();
      expect(stdout).toContain("test-client");
    });

    it("should redact device token in output", async () => {
      const { stdout } = await runCommand(
        ["push:devices:get", "test-device-id"],
        import.meta.url,
      );

      // Token should be redacted
      expect(stdout).toContain("redacted");
      expect(stdout).not.toContain("fake-fcm-token-12345");
    });

    it("should output JSON when --json flag is used", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        ["push:devices:get", "test-device-id", "--json"],
        import.meta.url,
      );

      const output = JSON.parse(stdout);
      expect(output.success).toBe(true);
      expect(output.device).toBeDefined();
      expect(output.device.id).toBe("test-device-id");
      expect(output.device.platform).toBe("android");
      expect(mock.push.admin.deviceRegistrations.get).toHaveBeenCalledOnce();
    });
  });

  describe("error handling", () => {
    it("should handle device not found (404)", async () => {
      const mock = getMockAblyRest();
      const error = new Error("Device not found");
      (error as Error & { code: number }).code = 40400;
      mock.push.admin.deviceRegistrations.get.mockRejectedValue(error);

      const { error: cmdError } = await runCommand(
        ["push:devices:get", "non-existent-device"],
        import.meta.url,
      );

      expect(cmdError).toBeDefined();
      expect(cmdError!.message).toMatch(/not found/i);
    });

    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.get.mockRejectedValue(
        new Error("API Error"),
      );

      const { error } = await runCommand(
        ["push:devices:get", "test-device-id"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should require device ID argument", async () => {
      const { error } = await runCommand(["push:devices:get"], import.meta.url);

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing.*argument|device.*id/i);
    });
  });
});
