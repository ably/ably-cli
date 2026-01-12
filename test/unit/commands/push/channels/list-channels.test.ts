import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../../helpers/mock-ably-rest.js";

describe("push:channels:list-channels command", () => {
  beforeEach(() => {
    // Set up default mock behavior for this test suite
    const mock = getMockAblyRest();
    mock.push.admin.channelSubscriptions.listChannels.mockResolvedValue({
      items: ["alerts", "notifications", "updates"],
      hasNext: () => false,
    });
  });

  describe("successful listing", () => {
    it("should list channels with push subscriptions", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        ["push:channels:list-channels"],
        import.meta.url,
      );

      expect(
        mock.push.admin.channelSubscriptions.listChannels,
      ).toHaveBeenCalledOnce();
      expect(stdout).toContain("alerts");
      expect(stdout).toContain("notifications");
      expect(stdout).toContain("updates");
    });

    it("should respect --limit flag", async () => {
      const mock = getMockAblyRest();

      await runCommand(
        ["push:channels:list-channels", "--limit", "50"],
        import.meta.url,
      );

      expect(
        mock.push.admin.channelSubscriptions.listChannels,
      ).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
    });

    it("should output JSON when --json flag is used", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        ["push:channels:list-channels", "--json"],
        import.meta.url,
      );

      const output = JSON.parse(stdout);
      expect(output.success).toBe(true);
      expect(output.channels).toBeDefined();
      expect(output.channels).toHaveLength(3);
      expect(output.channels).toContain("alerts");
      expect(output.count).toBe(3);
      expect(
        mock.push.admin.channelSubscriptions.listChannels,
      ).toHaveBeenCalledOnce();
    });

    it("should handle empty result set", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.channelSubscriptions.listChannels.mockResolvedValue({
        items: [],
        hasNext: () => false,
      });

      const { stdout } = await runCommand(
        ["push:channels:list-channels"],
        import.meta.url,
      );

      expect(stdout).toMatch(/no.*channels.*found/i);
    });
  });

  describe("error handling", () => {
    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.channelSubscriptions.listChannels.mockRejectedValue(
        new Error("API Error"),
      );

      const { error } = await runCommand(
        ["push:channels:list-channels"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
