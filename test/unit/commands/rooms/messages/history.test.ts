import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../../helpers/mock-ably-chat.js";
import { captureJsonLogs } from "../../../../helpers/ndjson.js";

describe("rooms:messages:history command", () => {
  beforeEach(() => {
    getMockAblyChat();
  });

  describe("help", () => {
    it("should show usage when --help is passed", async () => {
      const { stdout } = await runCommand(
        ["rooms:messages:history", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("USAGE");
    });
  });

  describe("argument validation", () => {
    it("should require room argument", async () => {
      const { error } = await runCommand(
        ["rooms:messages:history"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });

    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["rooms:messages:history", "test-room", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("functionality", () => {
    it("should retrieve room message history", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.history = vi.fn().mockResolvedValue({
        items: [
          {
            text: "Historical message 1",
            clientId: "client1",
            timestamp: new Date(Date.now() - 10_000),
            serial: "msg-1",
          },
          {
            text: "Historical message 2",
            clientId: "client2",
            timestamp: new Date(Date.now() - 5000),
            serial: "msg-2",
          },
        ],
      });

      const { stdout } = await runCommand(
        ["rooms:messages:history", "test-room"],
        import.meta.url,
      );

      expect(room.attach).toHaveBeenCalled();
      expect(room.messages.history).toHaveBeenCalled();
      expect(stdout).toContain("Historical message 1");
      expect(stdout).toContain("Historical message 2");
    });

    it("should display no messages found when history is empty", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.history = vi.fn().mockResolvedValue({ items: [] });

      const { stdout } = await runCommand(
        ["rooms:messages:history", "test-room"],
        import.meta.url,
      );

      expect(room.messages.history).toHaveBeenCalled();
      expect(stdout).toContain("Retrieved 0 messages");
      expect(stdout).toContain("No messages found");
    });

    it("should display metadata when --show-metadata is passed", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.history = vi.fn().mockResolvedValue({
        items: [
          {
            text: "Msg with metadata",
            clientId: "client1",
            timestamp: new Date(),
            serial: "msg-m1",
            metadata: { priority: "high" },
          },
        ],
      });

      const { stdout } = await runCommand(
        ["rooms:messages:history", "test-room", "--show-metadata"],
        import.meta.url,
      );

      expect(stdout).toContain("Metadata");
      expect(stdout).toContain("priority");
    });

    it("should emit JSON envelope with type result for --json", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.history = vi.fn().mockResolvedValue({
        items: [
          {
            text: "History msg",
            clientId: "client1",
            timestamp: new Date(Date.now() - 5000),
            serial: "msg-h1",
          },
        ],
      });

      const records = await captureJsonLogs(async () => {
        await runCommand(
          ["rooms:messages:history", "test-room", "--json"],
          import.meta.url,
        );
      });

      const results = records.filter(
        (r) => r.type === "result" && r.room === "test-room",
      );
      expect(results.length).toBeGreaterThan(0);
      const record = results[0];
      expect(record).toHaveProperty("type", "result");
      expect(record).toHaveProperty("command", "rooms:messages:history");
      expect(record).toHaveProperty("success", true);
      expect(record).toHaveProperty("room", "test-room");
      expect(record).toHaveProperty("messages");
    });
  });

  describe("flags", () => {
    it("should pass limit and order to history query", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.history = vi.fn().mockResolvedValue({ items: [] });

      await runCommand(
        [
          "rooms:messages:history",
          "test-room",
          "--limit",
          "25",
          "--order",
          "oldestFirst",
        ],
        import.meta.url,
      );

      expect(room.messages.history).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 25,
        }),
      );
    });

    it("should respect --start and --end flags with ISO 8601", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.history = vi.fn().mockResolvedValue({ items: [] });

      const start = "2025-01-01T00:00:00Z";
      const end = "2025-01-02T00:00:00Z";

      await runCommand(
        ["rooms:messages:history", "test-room", "--start", start, "--end", end],
        import.meta.url,
      );

      expect(room.messages.history).toHaveBeenCalledWith(
        expect.objectContaining({
          start: new Date(start).getTime(),
          end: new Date(end).getTime(),
        }),
      );
    });

    it("should accept Unix ms string for --start", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.history = vi.fn().mockResolvedValue({ items: [] });

      await runCommand(
        ["rooms:messages:history", "test-room", "--start", "1700000000000"],
        import.meta.url,
      );

      expect(room.messages.history).toHaveBeenCalledWith(
        expect.objectContaining({
          start: 1_700_000_000_000,
        }),
      );
    });

    it("should accept relative time for --start", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.history = vi.fn().mockResolvedValue({ items: [] });

      await runCommand(
        ["rooms:messages:history", "test-room", "--start", "1h"],
        import.meta.url,
      );

      const callArgs = room.messages.history.mock.calls[0][0];
      const oneHourAgo = Date.now() - 3_600_000;
      expect(callArgs.start).toBeGreaterThan(oneHourAgo - 5000);
      expect(callArgs.start).toBeLessThanOrEqual(oneHourAgo + 5000);
    });
  });

  describe("error handling", () => {
    it("should handle history API failure", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.history = vi
        .fn()
        .mockRejectedValue(new Error("History fetch failed"));

      const { error } = await runCommand(
        ["rooms:messages:history", "test-room"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toContain("History fetch failed");
    });

    it("should error when --start is after --end", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.history = vi.fn().mockResolvedValue({ items: [] });

      const { error } = await runCommand(
        [
          "rooms:messages:history",
          "test-room",
          "--start",
          "2025-01-02T00:00:00Z",
          "--end",
          "2025-01-01T00:00:00Z",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toContain(
        "--start must be earlier than or equal to --end",
      );
    });

    it("should output JSON error on failure with --json", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.history = vi.fn().mockRejectedValue(new Error("API error"));

      const records = await captureJsonLogs(async () => {
        await runCommand(
          ["rooms:messages:history", "test-room", "--json"],
          import.meta.url,
        );
      });

      const errors = records.filter(
        (r) => r.type === "error" || r.success === false,
      );
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
