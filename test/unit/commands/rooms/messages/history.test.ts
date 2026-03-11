import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../../helpers/mock-ably-chat.js";
import { captureJsonLogs } from "../../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("rooms:messages:history command", () => {
  beforeEach(() => {
    getMockAblyChat();
  });

  standardHelpTests("rooms:messages:history", import.meta.url);
  standardArgValidationTests("rooms:messages:history", import.meta.url, {
    requiredArgs: ["test-room"],
  });
  standardFlagTests("rooms:messages:history", import.meta.url, [
    "--json",
    "--limit",
    "--order",
    "--start",
    "--end",
    "--show-metadata",
  ]);

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
      expect(error?.message).toContain("History fetch failed");
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
      expect(error?.message).toContain(
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
