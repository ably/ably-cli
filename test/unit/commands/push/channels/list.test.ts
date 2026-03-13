import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import {
  getMockAblyRest,
  createMockPaginatedResult,
} from "../../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("push:channels:list command", () => {
  beforeEach(() => {
    getMockAblyRest();
  });

  standardHelpTests("push:channels:list", import.meta.url);
  standardArgValidationTests("push:channels:list", import.meta.url);
  standardFlagTests("push:channels:list", import.meta.url, [
    "--json",
    "--channel",
    "--device-id",
    "--client-id",
    "--limit",
  ]);

  describe("functionality", () => {
    it("should list subscriptions for a channel", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.channelSubscriptions.list.mockResolvedValue(
        createMockPaginatedResult([
          { channel: "my-channel", deviceId: "device-1" },
          { channel: "my-channel", clientId: "client-1" },
        ]),
      );

      const { stdout } = await runCommand(
        ["push:channels:list", "--channel", "my-channel"],
        import.meta.url,
      );

      expect(stdout).toContain("device-1");
      expect(stdout).toContain("client-1");
    });

    it("should handle empty list", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.channelSubscriptions.list.mockResolvedValue(
        createMockPaginatedResult([]),
      );

      const { stderr } = await runCommand(
        ["push:channels:list", "--channel", "my-channel"],
        import.meta.url,
      );

      expect(stderr).toContain("No subscriptions found");
    });

    it("should output JSON when requested", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.channelSubscriptions.list.mockResolvedValue(
        createMockPaginatedResult([
          { channel: "my-channel", deviceId: "device-1" },
        ]),
      );

      const { stdout } = await runCommand(
        ["push:channels:list", "--channel", "my-channel", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("subscriptions");
    });
  });

  describe("argument validation", () => {
    it("should require --channel flag", async () => {
      const { error } = await runCommand(
        ["push:channels:list"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.channelSubscriptions.list.mockRejectedValue(
        new Error("API error"),
      );

      const { error } = await runCommand(
        ["push:channels:list", "--channel", "my-channel"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
