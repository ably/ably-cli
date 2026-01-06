import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../../helpers/mock-ably-rest.js";

describe("push:channels:remove command", () => {
  beforeEach(() => {
    const mock = getMockAblyRest();
    mock.push.admin.channelSubscriptions.remove.mockReset();
    mock.push.admin.channelSubscriptions.remove.mockResolvedValue();
  });

  describe("successful removal", () => {
    it("should remove a device subscription with --force", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        [
          "push:channels:remove",
          "--channel",
          "alerts",
          "--device-id",
          "device-1",
          "--force",
        ],
        import.meta.url,
      );

      expect(mock.push.admin.channelSubscriptions.remove).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "alerts",
          deviceId: "device-1",
        }),
      );
      expect(stdout).toContain("removed successfully");
    });

    it("should remove a client subscription with --force", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        [
          "push:channels:remove",
          "--channel",
          "alerts",
          "--client-id",
          "client-1",
          "--force",
        ],
        import.meta.url,
      );

      expect(mock.push.admin.channelSubscriptions.remove).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "alerts",
          clientId: "client-1",
        }),
      );
      expect(stdout).toContain("removed successfully");
    });

    it("should output JSON when --json flag is used", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        [
          "push:channels:remove",
          "--channel",
          "alerts",
          "--device-id",
          "device-1",
          "--force",
          "--json",
        ],
        import.meta.url,
      );

      const output = JSON.parse(stdout);
      expect(output.success).toBe(true);
      expect(output.removed).toBe(true);
      expect(output.channel).toBe("alerts");
      expect(output.deviceId).toBe("device-1");
      expect(
        mock.push.admin.channelSubscriptions.remove,
      ).toHaveBeenCalledOnce();
    });
  });

  describe("validation", () => {
    it("should require --channel flag", async () => {
      const { error } = await runCommand(
        ["push:channels:remove", "--device-id", "device-1", "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/missing.*required.*flag.*channel/i);
    });

    it("should require either --device-id or --client-id", async () => {
      const { error } = await runCommand(
        ["push:channels:remove", "--channel", "alerts", "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(
        /device-id.*client-id.*must be specified/i,
      );
    });

    it("should not allow both --device-id and --client-id", async () => {
      const { error } = await runCommand(
        [
          "push:channels:remove",
          "--channel",
          "alerts",
          "--device-id",
          "device-1",
          "--client-id",
          "client-1",
          "--force",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/only one.*not both/i);
    });
  });

  describe("error handling", () => {
    it("should handle subscription not found (404)", async () => {
      const mock = getMockAblyRest();
      const error = new Error("Subscription not found");
      (error as Error & { code: number }).code = 40400;
      mock.push.admin.channelSubscriptions.remove.mockRejectedValue(error);

      const { error: cmdError } = await runCommand(
        [
          "push:channels:remove",
          "--channel",
          "alerts",
          "--device-id",
          "non-existent-device",
          "--force",
        ],
        import.meta.url,
      );

      expect(cmdError).toBeDefined();
      expect(cmdError!.message).toMatch(/not found/i);
    });

    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.channelSubscriptions.remove.mockRejectedValue(
        new Error("API Error"),
      );

      const { error } = await runCommand(
        [
          "push:channels:remove",
          "--channel",
          "alerts",
          "--device-id",
          "device-1",
          "--force",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
