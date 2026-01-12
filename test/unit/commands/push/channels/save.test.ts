import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../../helpers/mock-ably-rest.js";

describe("push:channels:save command", () => {
  beforeEach(() => {
    const mock = getMockAblyRest();
    mock.push.admin.channelSubscriptions.save.mockReset();
    mock.push.admin.channelSubscriptions.save.mockResolvedValue({
      channel: "test-channel",
      deviceId: "test-device-id",
    });
  });

  describe("successful subscription", () => {
    it("should subscribe a device to a channel", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        [
          "push:channels:save",
          "--channel",
          "test-channel",
          "--device-id",
          "test-device-id",
        ],
        import.meta.url,
      );

      expect(mock.push.admin.channelSubscriptions.save).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "test-channel",
          deviceId: "test-device-id",
        }),
      );
      expect(stdout).toContain("Successfully subscribed");
      expect(stdout).toContain("test-channel");
    });

    it("should subscribe a client to a channel", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.channelSubscriptions.save.mockResolvedValue({
        channel: "test-channel",
        clientId: "test-client-id",
      });

      const { stdout } = await runCommand(
        [
          "push:channels:save",
          "--channel",
          "test-channel",
          "--recipient-client-id",
          "test-client-id",
        ],
        import.meta.url,
      );

      expect(mock.push.admin.channelSubscriptions.save).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "test-channel",
          clientId: "test-client-id",
        }),
      );
      expect(stdout).toContain("Successfully subscribed");
      expect(stdout).toContain("test-client-id");
    });

    it("should output JSON when --json flag is used", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        [
          "push:channels:save",
          "--channel",
          "test-channel",
          "--device-id",
          "test-device-id",
          "--json",
        ],
        import.meta.url,
      );

      const output = JSON.parse(stdout);
      expect(output.success).toBe(true);
      expect(output.subscription).toBeDefined();
      expect(output.subscription.channel).toBe("test-channel");
      expect(output.subscription.deviceId).toBe("test-device-id");
      expect(mock.push.admin.channelSubscriptions.save).toHaveBeenCalledOnce();
    });
  });

  describe("validation", () => {
    it("should require --channel flag", async () => {
      const { error } = await runCommand(
        ["push:channels:save", "--device-id", "test-device-id"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/missing.*required.*flag.*channel/i);
    });

    it("should require either --device-id or --recipient-client-id", async () => {
      const { error } = await runCommand(
        ["push:channels:save", "--channel", "test-channel"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(
        /device-id.*client-id.*must be specified/i,
      );
    });

    it("should not allow both --device-id and --recipient-client-id", async () => {
      const { error } = await runCommand(
        [
          "push:channels:save",
          "--channel",
          "test-channel",
          "--device-id",
          "device-1",
          "--recipient-client-id",
          "client-1",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/only one.*not both/i);
    });
  });

  describe("error handling", () => {
    it("should handle push not enabled error (40100)", async () => {
      const mock = getMockAblyRest();
      const error = new Error("Push not enabled");
      (error as Error & { code: number }).code = 40100;
      mock.push.admin.channelSubscriptions.save.mockRejectedValue(error);

      const { error: cmdError } = await runCommand(
        [
          "push:channels:save",
          "--channel",
          "test-channel",
          "--device-id",
          "test-device-id",
        ],
        import.meta.url,
      );

      expect(cmdError).toBeDefined();
      expect(cmdError!.message).toMatch(/push not enabled/i);
    });

    it("should handle device/client not found error (40400)", async () => {
      const mock = getMockAblyRest();
      const error = new Error("Not found");
      (error as Error & { code: number }).code = 40400;
      mock.push.admin.channelSubscriptions.save.mockRejectedValue(error);

      const { error: cmdError } = await runCommand(
        [
          "push:channels:save",
          "--channel",
          "test-channel",
          "--device-id",
          "non-existent-device",
        ],
        import.meta.url,
      );

      expect(cmdError).toBeDefined();
      expect(cmdError!.message).toMatch(/not found/i);
    });

    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.channelSubscriptions.save.mockRejectedValue(
        new Error("API Error"),
      );

      const { error } = await runCommand(
        [
          "push:channels:save",
          "--channel",
          "test-channel",
          "--device-id",
          "test-device-id",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
