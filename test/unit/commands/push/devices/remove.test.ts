import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../../helpers/mock-ably-rest.js";

describe("push:devices:remove command", () => {
  beforeEach(() => {
    const mock = getMockAblyRest();
    mock.push.admin.deviceRegistrations.remove.mockReset();
    mock.push.admin.deviceRegistrations.remove.mockResolvedValue();
  });

  describe("successful removal", () => {
    it("should remove a device by ID with --force", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        ["push:devices:remove", "test-device-id", "--force"],
        import.meta.url,
      );

      expect(mock.push.admin.deviceRegistrations.remove).toHaveBeenCalledWith(
        "test-device-id",
      );
      expect(stdout).toContain("removed successfully");
      expect(stdout).toContain("test-device-id");
    });

    it("should output JSON when --json flag is used", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        ["push:devices:remove", "test-device-id", "--force", "--json"],
        import.meta.url,
      );

      const output = JSON.parse(stdout);
      expect(output.success).toBe(true);
      expect(output.deviceId).toBe("test-device-id");
      expect(mock.push.admin.deviceRegistrations.remove).toHaveBeenCalledOnce();
    });
  });

  describe("validation", () => {
    it("should require device ID argument", async () => {
      const { error } = await runCommand(
        ["push:devices:remove", "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing.*argument|device.*id/i);
    });
  });

  describe("error handling", () => {
    it("should handle device not found", async () => {
      const mock = getMockAblyRest();
      const error = new Error("Device not found");
      (error as Error & { code: number }).code = 40400;
      mock.push.admin.deviceRegistrations.remove.mockRejectedValue(error);

      const { error: cmdError } = await runCommand(
        ["push:devices:remove", "non-existent-device", "--force"],
        import.meta.url,
      );

      expect(cmdError).toBeDefined();
    });

    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.remove.mockRejectedValue(
        new Error("API Error"),
      );

      const { error } = await runCommand(
        ["push:devices:remove", "test-device-id", "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
