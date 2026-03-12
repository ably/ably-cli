import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

describe("logs:history command", () => {
  beforeEach(() => {
    getMockAblyRest();
  });

  standardHelpTests("logs:history", import.meta.url);
  standardArgValidationTests("logs:history", import.meta.url);
  standardFlagTests("logs:history", import.meta.url, [
    "--json",
    "--limit",
    "--direction",
  ]);

  describe("error handling", () => {
    it("should handle API errors gracefully", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("[meta]log");
      channel.history.mockRejectedValue(new Error("API error"));

      const { error } = await runCommand(["logs:history"], import.meta.url);

      expect(error).toBeDefined();
    });
  });

  describe("functionality", () => {
    it("should pass --start to history params", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("[meta]log");
      channel.history.mockResolvedValue({ items: [] });

      const start = "2023-06-01T00:00:00Z";
      await runCommand(["logs:history", "--start", start], import.meta.url);

      expect(channel.history).toHaveBeenCalledWith(
        expect.objectContaining({
          start: new Date(start).getTime(),
        }),
      );
    });

    it("should error when --start is after --end", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("[meta]log");
      channel.history.mockResolvedValue({ items: [] });

      const { error } = await runCommand(
        [
          "logs:history",
          "--start",
          "2023-06-02T00:00:00Z",
          "--end",
          "2023-06-01T00:00:00Z",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain(
        "--start must be earlier than or equal to --end",
      );
    });

    it("should pass --direction to history params", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("[meta]log");
      channel.history.mockResolvedValue({ items: [] });

      await runCommand(
        ["logs:history", "--direction", "forwards"],
        import.meta.url,
      );

      expect(channel.history).toHaveBeenCalledWith(
        expect.objectContaining({ direction: "forwards" }),
      );
    });

    it("should default to backwards direction", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("[meta]log");
      channel.history.mockResolvedValue({ items: [] });

      await runCommand(["logs:history"], import.meta.url);

      expect(channel.history).toHaveBeenCalledWith(
        expect.objectContaining({ direction: "backwards" }),
      );
    });

    it("should pass --limit to history params", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("[meta]log");
      channel.history.mockResolvedValue({ items: [] });

      await runCommand(["logs:history", "--limit", "50"], import.meta.url);

      expect(channel.history).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50 }),
      );
    });

    it("should show warning when results equal limit", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("[meta]log");

      // Create exactly 10 mock messages to match limit
      const messages = Array.from({ length: 10 }, (_, i) => ({
        id: `msg-${i}`,
        name: "test.event",
        data: { info: `message ${i}` },
        timestamp: 1700000000000 + i * 1000,
        clientId: "client-1",
        connectionId: "conn-1",
      }));
      channel.history.mockResolvedValue({ items: messages });

      const { stdout } = await runCommand(
        ["logs:history", "--limit", "10"],
        import.meta.url,
      );

      expect(stdout).toContain("Showing maximum of 10 logs");
      expect(stdout).toContain("Use --limit to show more");
    });

    it("should show 'No application logs found' on empty results", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("[meta]log");
      channel.history.mockResolvedValue({ items: [] });

      const { stdout } = await runCommand(["logs:history"], import.meta.url);

      expect(stdout).toContain("No application logs found");
    });
  });
});
