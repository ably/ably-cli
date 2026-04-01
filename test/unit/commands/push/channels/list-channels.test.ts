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

describe("push:channels:list-channels command", () => {
  beforeEach(() => {
    getMockAblyRest();
  });

  standardHelpTests("push:channels:list-channels", import.meta.url);
  standardArgValidationTests("push:channels:list-channels", import.meta.url);
  standardFlagTests("push:channels:list-channels", import.meta.url, [
    "--json",
    "--limit",
  ]);

  describe("functionality", () => {
    it("should list channels with push subscriptions", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.channelSubscriptions.listChannels.mockResolvedValue(
        createMockPaginatedResult(["channel-1", "channel-2", "channel-3"]),
      );

      const { stdout } = await runCommand(
        ["push:channels:list-channels"],
        import.meta.url,
      );

      expect(stdout).toContain("channel-1");
      expect(stdout).toContain("channel-2");
      expect(stdout).toContain("channel-3");
    });

    it("should handle empty list", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.channelSubscriptions.listChannels.mockResolvedValue(
        createMockPaginatedResult([]),
      );

      const { stdout } = await runCommand(
        ["push:channels:list-channels"],
        import.meta.url,
      );

      expect(stdout).toContain("No channels with push subscriptions found");
    });

    it("should output JSON when requested", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.channelSubscriptions.listChannels.mockResolvedValue(
        createMockPaginatedResult(["channel-1"]),
      );

      const { stdout } = await runCommand(
        ["push:channels:list-channels", "--json"],
        import.meta.url,
      );

      const records = stdout
        .trim()
        .split("\n")
        .map((line: string) => JSON.parse(line));
      const result = records.find(
        (r: Record<string, unknown>) => r.type === "result",
      );
      expect(result).toBeDefined();
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("channels");
    });
  });

  describe("error handling", () => {
    it("should handle API errors", async () => {
      const mock = getMockAblyRest();
      mock.push.admin.channelSubscriptions.listChannels.mockRejectedValue(
        new Error("API error"),
      );

      const { error } = await runCommand(
        ["push:channels:list-channels"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
