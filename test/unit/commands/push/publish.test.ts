import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../helpers/mock-ably-rest.js";

describe("push:publish command", () => {
  beforeEach(() => {
    const mock = getMockAblyRest();
    mock.push.admin.publish.mockReset();
    mock.push.admin.publish.mockResolvedValue();
  });

  describe("successful publish", () => {
    it("should publish notification to a device", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        [
          "push:publish",
          "--device-id",
          "test-device",
          "--title",
          "Hello",
          "--body",
          "World",
        ],
        import.meta.url,
      );

      expect(mock.push.admin.publish).toHaveBeenCalledWith(
        { deviceId: "test-device" },
        expect.objectContaining({
          notification: expect.objectContaining({
            title: "Hello",
            body: "World",
          }),
        }),
      );
      expect(stdout).toContain("sent successfully");
      expect(stdout).toContain("test-device");
    });

    it("should publish notification to a client", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        [
          "push:publish",
          "--client-id",
          "test-client",
          "--title",
          "Alert",
          "--body",
          "Message",
        ],
        import.meta.url,
      );

      expect(mock.push.admin.publish).toHaveBeenCalledWith(
        { clientId: "test-client" },
        expect.objectContaining({
          notification: expect.objectContaining({
            title: "Alert",
            body: "Message",
          }),
        }),
      );
      expect(stdout).toContain("sent successfully");
      expect(stdout).toContain("test-client");
    });

    it("should include optional notification fields", async () => {
      const mock = getMockAblyRest();

      await runCommand(
        [
          "push:publish",
          "--device-id",
          "test-device",
          "--title",
          "Test",
          "--sound",
          "default",
          "--icon",
          "notification_icon",
          "--badge",
          "5",
          "--collapse-key",
          "group1",
          "--ttl",
          "3600",
        ],
        import.meta.url,
      );

      expect(mock.push.admin.publish).toHaveBeenCalledWith(
        { deviceId: "test-device" },
        expect.objectContaining({
          notification: expect.objectContaining({
            title: "Test",
            sound: "default",
            icon: "notification_icon",
            badge: 5,
            collapseKey: "group1",
            ttl: 3600,
          }),
        }),
      );
    });

    it("should include custom data payload", async () => {
      const mock = getMockAblyRest();

      await runCommand(
        [
          "push:publish",
          "--device-id",
          "test-device",
          "--title",
          "Order",
          "--data",
          '{"orderId":"123","status":"shipped"}',
        ],
        import.meta.url,
      );

      expect(mock.push.admin.publish).toHaveBeenCalledWith(
        { deviceId: "test-device" },
        expect.objectContaining({
          notification: expect.objectContaining({ title: "Order" }),
          data: { orderId: "123", status: "shipped" },
        }),
      );
    });

    it("should include platform-specific overrides", async () => {
      const mock = getMockAblyRest();

      await runCommand(
        [
          "push:publish",
          "--device-id",
          "test-device",
          "--title",
          "Test",
          "--apns",
          '{"aps":{"alert":"custom"}}',
          "--fcm",
          '{"android":{"priority":"high"}}',
          "--web",
          '{"notification":{"requireInteraction":true}}',
        ],
        import.meta.url,
      );

      expect(mock.push.admin.publish).toHaveBeenCalledWith(
        { deviceId: "test-device" },
        expect.objectContaining({
          apns: { aps: { alert: "custom" } },
          fcm: { android: { priority: "high" } },
          web: { notification: { requireInteraction: true } },
        }),
      );
    });

    it("should publish with inline JSON payload", async () => {
      const mock = getMockAblyRest();

      await runCommand(
        [
          "push:publish",
          "--device-id",
          "test-device",
          "--payload",
          '{"notification":{"title":"From payload","body":"Test body"}}',
        ],
        import.meta.url,
      );

      expect(mock.push.admin.publish).toHaveBeenCalledWith(
        { deviceId: "test-device" },
        { notification: { title: "From payload", body: "Test body" } },
      );
    });

    it("should output JSON when --json flag is used", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        [
          "push:publish",
          "--device-id",
          "test-device",
          "--title",
          "Hello",
          "--json",
        ],
        import.meta.url,
      );

      const output = JSON.parse(stdout);
      expect(output.success).toBe(true);
      expect(output.published).toBe(true);
      expect(output.recipient.deviceId).toBe("test-device");
      expect(mock.push.admin.publish).toHaveBeenCalledOnce();
    });
  });

  describe("validation", () => {
    it("should require either --device-id or --client-id", async () => {
      const { error } = await runCommand(
        ["push:publish", "--title", "Hello"],
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
          "push:publish",
          "--device-id",
          "device-1",
          "--client-id",
          "client-1",
          "--title",
          "Hello",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/only one.*not both/i);
    });

    it("should require --payload or at least --title or --body", async () => {
      const { error } = await runCommand(
        ["push:publish", "--device-id", "test-device"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(
        /payload.*title.*body.*must be specified/i,
      );
    });

    it("should not allow --payload with --title or --body", async () => {
      const { error } = await runCommand(
        [
          "push:publish",
          "--device-id",
          "test-device",
          "--payload",
          '{"notification":{}}',
          "--title",
          "Hello",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/cannot use --payload with --title/i);
    });

    it("should reject invalid JSON in --data", async () => {
      const { error } = await runCommand(
        [
          "push:publish",
          "--device-id",
          "test-device",
          "--title",
          "Hello",
          "--data",
          "{invalid-json}",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/invalid json/i);
    });

    it("should reject invalid JSON in --payload", async () => {
      const { error } = await runCommand(
        [
          "push:publish",
          "--device-id",
          "test-device",
          "--payload",
          "{invalid-json}",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/invalid json/i);
    });
  });

  describe("error handling", () => {
    it("should handle device/client not found (404)", async () => {
      const mock = getMockAblyRest();
      const error = new Error("Device not found");
      (error as Error & { code: number }).code = 40400;
      mock.push.admin.publish.mockRejectedValue(error);

      const { error: cmdError } = await runCommand(
        [
          "push:publish",
          "--device-id",
          "non-existent-device",
          "--title",
          "Hello",
        ],
        import.meta.url,
      );

      expect(cmdError).toBeDefined();
      expect(cmdError!.message).toMatch(/not found/i);
    });

    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.publish.mockRejectedValue(new Error("API Error"));

      const { error } = await runCommand(
        ["push:publish", "--device-id", "test-device", "--title", "Hello"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
