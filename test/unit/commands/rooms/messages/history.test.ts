import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../../helpers/mock-ably-chat.js";
import { createMockPaginatedResult } from "../../../../helpers/mock-ably-rest.js";
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
    it("should retrieve room message history with action and serial", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.history = vi.fn().mockResolvedValue(
        createMockPaginatedResult([
          {
            text: "Historical message 1",
            clientId: "client1",
            timestamp: new Date(Date.now() - 10_000),
            serial: "msg-1",
            action: "message.created",
          },
          {
            text: "Historical message 2",
            clientId: "client2",
            timestamp: new Date(Date.now() - 5000),
            serial: "msg-2",
            action: "message.updated",
          },
        ]),
      );

      const { stdout } = await runCommand(
        ["rooms:messages:history", "test-room"],
        import.meta.url,
      );

      expect(room.messages.history).toHaveBeenCalled();
      expect(stdout).toContain("Historical message 1");
      expect(stdout).toContain("Historical message 2");
      expect(stdout).toContain("message.created");
      expect(stdout).toContain("message.updated");
      expect(stdout).toContain("Serial");
      expect(stdout).toContain("msg-1");
      expect(stdout).toContain("msg-2");
    });

    it("should display no messages found when history is empty", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.history = vi
        .fn()
        .mockResolvedValue(createMockPaginatedResult([]));

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

      room.messages.history = vi.fn().mockResolvedValue(
        createMockPaginatedResult([
          {
            text: "Msg with metadata",
            clientId: "client1",
            timestamp: new Date(),
            serial: "msg-m1",
            action: "message.created",
            metadata: { priority: "high" },
          },
        ]),
      );

      const { stdout } = await runCommand(
        ["rooms:messages:history", "test-room", "--show-metadata"],
        import.meta.url,
      );

      expect(stdout).toContain("Metadata");
      expect(stdout).toContain("priority");
    });

    it("should emit JSON envelope with serial, action, and metadata", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.messages.history = vi.fn().mockResolvedValue(
        createMockPaginatedResult([
          {
            text: "History msg",
            clientId: "client1",
            timestamp: new Date(Date.now() - 5000),
            serial: "msg-h1",
            action: "message.created",
            metadata: { key: "value" },
          },
        ]),
      );

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
      const messages = record.messages as Array<Record<string, unknown>>;
      expect(messages[0]).toHaveProperty("serial", "msg-h1");
      expect(messages[0]).toHaveProperty("action", "message.created");
      expect(messages[0]).toHaveProperty("metadata", { key: "value" });
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

      room.messages.history = vi
        .fn()
        .mockResolvedValue(createMockPaginatedResult([]));

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

    it("should reject empty room name", async () => {
      const { error } = await runCommand(
        ["rooms:messages:history", ""],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(
        /Missing 1 required arg|Room name cannot be empty/,
      );
    });
  });
});
