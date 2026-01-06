import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../../helpers/mock-ably-rest.js";

describe("push:channels:list command", () => {
  beforeEach(() => {
    const mock = getMockAblyRest();
    mock.push.admin.channelSubscriptions.list.mockReset();
    mock.push.admin.channelSubscriptions.list.mockResolvedValue({
      items: [
        { channel: "alerts", deviceId: "device-1" },
        { channel: "alerts", clientId: "client-1" },
      ],
      hasNext: () => false,
    });
  });

  describe("successful listing", () => {
    it("should list subscriptions for a channel", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        ["push:channels:list", "--channel", "alerts"],
        import.meta.url,
      );

      expect(mock.push.admin.channelSubscriptions.list).toHaveBeenCalledWith(
        expect.objectContaining({ channel: "alerts" }),
      );
      expect(stdout).toContain("device-1");
      expect(stdout).toContain("client-1");
    });

    it("should filter by --device-id", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.channelSubscriptions.list.mockResolvedValue({
        items: [{ channel: "alerts", deviceId: "device-1" }],
        hasNext: () => false,
      });

      const { stdout } = await runCommand(
        [
          "push:channels:list",
          "--channel",
          "alerts",
          "--device-id",
          "device-1",
        ],
        import.meta.url,
      );

      expect(mock.push.admin.channelSubscriptions.list).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "alerts",
          deviceId: "device-1",
        }),
      );
      expect(stdout).toContain("device-1");
    });

    it("should filter by --client-id", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.channelSubscriptions.list.mockResolvedValue({
        items: [{ channel: "alerts", clientId: "client-1" }],
        hasNext: () => false,
      });

      const { stdout } = await runCommand(
        [
          "push:channels:list",
          "--channel",
          "alerts",
          "--client-id",
          "client-1",
        ],
        import.meta.url,
      );

      expect(mock.push.admin.channelSubscriptions.list).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "alerts",
          clientId: "client-1",
        }),
      );
      expect(stdout).toContain("client-1");
    });

    it("should respect --limit flag", async () => {
      const mock = getMockAblyRest();

      await runCommand(
        ["push:channels:list", "--channel", "alerts", "--limit", "50"],
        import.meta.url,
      );

      expect(mock.push.admin.channelSubscriptions.list).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50 }),
      );
    });

    it("should output JSON when --json flag is used", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        ["push:channels:list", "--channel", "alerts", "--json"],
        import.meta.url,
      );

      const output = JSON.parse(stdout);
      expect(output.success).toBe(true);
      expect(output.subscriptions).toBeDefined();
      expect(output.subscriptions).toHaveLength(2);
      expect(output.count).toBe(2);
      expect(mock.push.admin.channelSubscriptions.list).toHaveBeenCalledOnce();
    });

    it("should handle empty result set", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.channelSubscriptions.list.mockResolvedValue({
        items: [],
        hasNext: () => false,
      });

      const { stdout } = await runCommand(
        ["push:channels:list", "--channel", "alerts"],
        import.meta.url,
      );

      expect(stdout).toMatch(/no.*subscriptions.*found/i);
    });
  });

  describe("validation", () => {
    it("should require --channel flag", async () => {
      const { error } = await runCommand(
        ["push:channels:list"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/missing.*required.*flag.*channel/i);
    });
  });

  describe("error handling", () => {
    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.channelSubscriptions.list.mockRejectedValue(
        new Error("API Error"),
      );

      const { error } = await runCommand(
        ["push:channels:list", "--channel", "alerts"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
