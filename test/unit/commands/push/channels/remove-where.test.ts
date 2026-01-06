import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../../helpers/mock-ably-rest.js";

describe("push:channels:remove-where command", () => {
  beforeEach(() => {
    const mock = getMockAblyRest();
    mock.push.admin.channelSubscriptions.removeWhere.mockReset();
    mock.push.admin.channelSubscriptions.removeWhere.mockResolvedValue();
  });

  describe("successful removal", () => {
    it("should remove subscriptions by --device-id with --force", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        [
          "push:channels:remove-where",
          "--channel",
          "alerts",
          "--device-id",
          "device-1",
          "--force",
        ],
        import.meta.url,
      );

      expect(
        mock.push.admin.channelSubscriptions.removeWhere,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "alerts",
          deviceId: "device-1",
        }),
      );
      expect(stdout).toContain("removed successfully");
    });

    it("should remove subscriptions by --client-id with --force", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        [
          "push:channels:remove-where",
          "--channel",
          "alerts",
          "--client-id",
          "client-1",
          "--force",
        ],
        import.meta.url,
      );

      expect(
        mock.push.admin.channelSubscriptions.removeWhere,
      ).toHaveBeenCalledWith(
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
          "push:channels:remove-where",
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
        mock.push.admin.channelSubscriptions.removeWhere,
      ).toHaveBeenCalledOnce();
    });
  });

  describe("validation", () => {
    it("should require --channel flag", async () => {
      const { error } = await runCommand(
        ["push:channels:remove-where", "--device-id", "device-1", "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/missing.*required.*flag.*channel/i);
    });

    it("should require at least one filter criterion", async () => {
      const { error } = await runCommand(
        ["push:channels:remove-where", "--channel", "alerts", "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/filter.*required|device-id.*client-id/i);
    });
  });

  describe("error handling", () => {
    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.channelSubscriptions.removeWhere.mockRejectedValue(
        new Error("API Error"),
      );

      const { error } = await runCommand(
        [
          "push:channels:remove-where",
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
