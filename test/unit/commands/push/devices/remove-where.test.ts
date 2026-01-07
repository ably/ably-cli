import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../../helpers/mock-ably-rest.js";

describe("push:devices:remove-where command", () => {
  beforeEach(() => {
    const mock = getMockAblyRest();
    mock.push.admin.deviceRegistrations.removeWhere.mockReset();
    mock.push.admin.deviceRegistrations.removeWhere.mockResolvedValue();
  });

  describe("successful removal", () => {
    it("should remove devices by --recipient-client-id with --force", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        [
          "push:devices:remove-where",
          "--recipient-client-id",
          "test-client",
          "--force",
        ],
        import.meta.url,
      );

      expect(
        mock.push.admin.deviceRegistrations.removeWhere,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: "test-client" }),
      );
      expect(stdout).toContain("removed successfully");
    });

    it("should remove devices by --device-id with --force", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        ["push:devices:remove-where", "--device-id", "test-device", "--force"],
        import.meta.url,
      );

      expect(
        mock.push.admin.deviceRegistrations.removeWhere,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ deviceId: "test-device" }),
      );
      expect(stdout).toContain("removed successfully");
    });

    it("should output JSON when --json flag is used", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        [
          "push:devices:remove-where",
          "--recipient-client-id",
          "test-client",
          "--force",
          "--json",
        ],
        import.meta.url,
      );

      const output = JSON.parse(stdout);
      expect(output.success).toBe(true);
      expect(output.removed).toBe(true);
      expect(output.filter).toBeDefined();
      expect(output.filter.clientId).toBe("test-client");
      expect(
        mock.push.admin.deviceRegistrations.removeWhere,
      ).toHaveBeenCalledOnce();
    });
  });

  describe("validation", () => {
    it("should require at least one filter criterion", async () => {
      const { error } = await runCommand(
        ["push:devices:remove-where", "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/filter.*required|client-id.*device-id/i);
    });
  });

  describe("error handling", () => {
    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.deviceRegistrations.removeWhere.mockRejectedValue(
        new Error("API Error"),
      );

      const { error } = await runCommand(
        [
          "push:devices:remove-where",
          "--recipient-client-id",
          "test-client",
          "--force",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
