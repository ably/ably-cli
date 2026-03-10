import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../helpers/mock-ably-rest.js";

describe("channels:history command", () => {
  beforeEach(() => {
    // Configure the centralized mock with test data
    const mock = getMockAblyRest();
    const channel = mock.channels._getChannel("test-channel");
    channel.history.mockResolvedValue({
      items: [
        {
          id: "msg-1",
          name: "test-event",
          data: { text: "Hello world" },
          timestamp: 1700000000000,
          clientId: "client-1",
          connectionId: "conn-1",
          version: {
            serial: "v1-serial",
            timestamp: 1700000000000,
            clientId: "updater-1",
          },
          annotations: {
            summary: {
              "reaction:distinct.v1": {
                "👍": {
                  total: 3,
                  clientIds: ["c1", "c2", "c3"],
                  clipped: false,
                },
              },
            },
          },
        },
        {
          id: "msg-2",
          name: "another-event",
          data: "Plain text message",
          timestamp: 1700000001000,
          clientId: "client-2",
          connectionId: "conn-2",
        },
      ],
    });
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["channels:history", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Retrieve message history");
      expect(stdout).toContain("USAGE");
      expect(stdout).toContain("CHANNEL");
    });

    it("should display examples in help", async () => {
      const { stdout } = await runCommand(
        ["channels:history", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("EXAMPLES");
      expect(stdout).toContain("history");
    });
  });

  describe("argument validation", () => {
    it("should require channel argument", async () => {
      const { error } = await runCommand(["channels:history"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/missing.*channel|required/i);
    });
  });

  describe("history retrieval", () => {
    it("should retrieve channel history successfully", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      const { stdout } = await runCommand(
        ["channels:history", "test-channel"],
        import.meta.url,
      );

      // Should show message fields in the new format
      expect(stdout).toContain("Timestamp:");
      expect(stdout).toContain("Channel:");
      expect(stdout).toContain("test-channel");
      expect(stdout).toContain("[1]");
      expect(stdout).toContain("[2]");
      expect(channel.history).toHaveBeenCalled();
    });

    it("should display message details", async () => {
      const { stdout } = await runCommand(
        ["channels:history", "test-channel"],
        import.meta.url,
      );

      expect(stdout).toContain("Event: test-event");
      expect(stdout).toContain("Hello world");
      expect(stdout).toContain("Client ID:");
      expect(stdout).toContain("client-1");
      expect(stdout).toContain("ID:");
      expect(stdout).toContain("msg-1");
    });

    it("should display version fields when present", async () => {
      const { stdout } = await runCommand(
        ["channels:history", "test-channel"],
        import.meta.url,
      );

      expect(stdout).toContain("Version:");
      expect(stdout).toContain("v1-serial");
      expect(stdout).toContain("updater-1");
    });

    it("should display annotations summary when present", async () => {
      const { stdout } = await runCommand(
        ["channels:history", "test-channel"],
        import.meta.url,
      );

      expect(stdout).toContain("Annotations:");
      expect(stdout).toContain("reaction:distinct.v1:");
    });

    it("should handle empty history", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");
      channel.history.mockResolvedValue({ items: [] });

      const { stdout } = await runCommand(
        ["channels:history", "test-channel"],
        import.meta.url,
      );

      expect(stdout).toContain("No messages found");
    });

    it("should output JSON format when --json flag is used", async () => {
      const { stdout } = await runCommand(
        ["channels:history", "test-channel", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("id", "msg-1");
      expect(result[0]).toHaveProperty("event", "test-event");
      expect(result[0]).toHaveProperty("channel", "test-channel");
      expect(result[0]).toHaveProperty("timestamp");
      expect(result[0]).toHaveProperty("data");
      expect(result[0].data).toEqual({ text: "Hello world" });
    });

    it("should include version in JSON output when present", async () => {
      const { stdout } = await runCommand(
        ["channels:history", "test-channel", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result[0]).toHaveProperty("version");
      expect(result[0].version).toEqual({
        serial: "v1-serial",
        timestamp: 1700000000000,
        clientId: "updater-1",
      });
      // Second message has no version
      expect(result[1]).not.toHaveProperty("version");
    });

    it("should include annotations in JSON output when present", async () => {
      const { stdout } = await runCommand(
        ["channels:history", "test-channel", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result[0]).toHaveProperty("annotations");
      expect(result[0].annotations.summary).toHaveProperty(
        "reaction:distinct.v1",
      );
      expect(
        result[0].annotations.summary["reaction:distinct.v1"]["👍"],
      ).toEqual({
        total: 3,
        clientIds: ["c1", "c2", "c3"],
        clipped: false,
      });
      // Second message has no annotations
      expect(result[1]).not.toHaveProperty("annotations");
    });

    it("should respect --limit flag", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        ["channels:history", "test-channel", "--limit", "10"],
        import.meta.url,
      );

      expect(channel.history).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10 }),
      );
    });

    it("should respect --direction flag", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        ["channels:history", "test-channel", "--direction", "forwards"],
        import.meta.url,
      );

      expect(channel.history).toHaveBeenCalledWith(
        expect.objectContaining({ direction: "forwards" }),
      );
    });

    it("should respect --start and --end flags", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");
      const start = "2023-01-01T00:00:00Z";
      const end = "2023-01-02T00:00:00Z";

      await runCommand(
        ["channels:history", "test-channel", "--start", start, "--end", end],
        import.meta.url,
      );

      expect(channel.history).toHaveBeenCalledWith(
        expect.objectContaining({
          start: new Date(start).getTime(),
          end: new Date(end).getTime(),
        }),
      );
    });

    it("should accept Unix ms string for --start", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        ["channels:history", "test-channel", "--start", "1700000000000"],
        import.meta.url,
      );

      expect(channel.history).toHaveBeenCalledWith(
        expect.objectContaining({
          start: 1700000000000,
        }),
      );
    });

    it("should accept relative time for --start", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        ["channels:history", "test-channel", "--start", "1h"],
        import.meta.url,
      );

      // The start value should be approximately 1 hour ago
      const callArgs = channel.history.mock.calls[0][0];
      const oneHourAgo = Date.now() - 3_600_000;
      expect(callArgs.start).toBeGreaterThan(oneHourAgo - 5000);
      expect(callArgs.start).toBeLessThanOrEqual(oneHourAgo + 5000);
    });

    it("should accept relative time for --end", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        ["channels:history", "test-channel", "--end", "30m"],
        import.meta.url,
      );

      // The end value should be approximately 30 minutes ago
      const callArgs = channel.history.mock.calls[0][0];
      const thirtyMinAgo = Date.now() - 30 * 60_000;
      expect(callArgs.end).toBeGreaterThan(thirtyMinAgo - 5000);
      expect(callArgs.end).toBeLessThanOrEqual(thirtyMinAgo + 5000);
    });

    it("should handle API errors gracefully", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");
      channel.history.mockRejectedValue(new Error("API error"));

      const { error } = await runCommand(
        ["channels:history", "test-channel"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Error retrieving channel history");
    });
  });

  describe("flags", () => {
    it("should pass cipher option to channel when --cipher flag is used", async () => {
      const mock = getMockAblyRest();

      await runCommand(
        ["channels:history", "test-channel", "--cipher", "my-encryption-key"],
        import.meta.url,
      );

      // Verify channel.get was called with cipher option
      expect(mock.channels.get).toHaveBeenCalledWith(
        "test-channel",
        expect.objectContaining({
          cipher: { key: "my-encryption-key" },
        }),
      );
    });
  });
});
