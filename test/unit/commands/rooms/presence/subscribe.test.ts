import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../../helpers/mock-ably-chat.js";
import { captureJsonLogs } from "../../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("rooms:presence:subscribe command", () => {
  beforeEach(() => {
    getMockAblyChat();
  });

  standardHelpTests("rooms:presence:subscribe", import.meta.url);
  standardArgValidationTests("rooms:presence:subscribe", import.meta.url, {
    requiredArgs: ["test-room"],
  });
  standardFlagTests("rooms:presence:subscribe", import.meta.url, ["--json"]);

  describe("functionality", () => {
    it("should subscribe to presence events and display them", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");
      const capturedLogs: string[] = [];

      const logSpy = vi.spyOn(console, "log").mockImplementation((msg) => {
        capturedLogs.push(String(msg));
      });

      // Capture the presence callback
      let presenceCallback: ((event: unknown) => void) | null = null;
      room.presence.subscribe.mockImplementation((callback) => {
        presenceCallback = callback;
        return { unsubscribe: vi.fn() };
      });

      const commandPromise = runCommand(
        ["rooms:presence:subscribe", "test-room"],
        import.meta.url,
      );

      await vi.waitFor(
        () => {
          expect(room.presence.subscribe).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );

      // Simulate a presence event
      presenceCallback!({
        type: "enter",
        member: {
          clientId: "user-123",
          connectionId: "conn-123",
          data: { name: "Test User" },
          updatedAt: new Date(),
        },
      });

      await commandPromise;

      logSpy.mockRestore();

      // Verify subscription was set up
      expect(chatMock.rooms.get).toHaveBeenCalledWith("test-room");
      expect(room.presence.subscribe).toHaveBeenCalled();
      expect(room.attach).toHaveBeenCalled();

      // Verify output contains presence data
      const output = capturedLogs.join("\n");
      expect(output).toContain("user-123");
      expect(output).toContain("enter");
    });

    it("should output JSON format when --json flag is used", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      // Capture the presence callback
      let presenceCallback: ((event: unknown) => void) | null = null;
      room.presence.subscribe.mockImplementation((callback) => {
        presenceCallback = callback;
        return { unsubscribe: vi.fn() };
      });

      const allRecords = await captureJsonLogs(async () => {
        const commandPromise = runCommand(
          ["rooms:presence:subscribe", "test-room", "--json"],
          import.meta.url,
        );

        await vi.waitFor(
          () => {
            expect(room.presence.subscribe).toHaveBeenCalled();
          },
          { timeout: 1000 },
        );

        // Simulate presence event
        if (presenceCallback) {
          presenceCallback({
            type: "leave",
            member: {
              clientId: "user-456",
              connectionId: "conn-456",
              data: {},
              updatedAt: new Date(),
            },
          });
        }

        await commandPromise;
      });

      // Verify subscription was set up
      expect(room.presence.subscribe).toHaveBeenCalled();
      expect(room.attach).toHaveBeenCalled();

      // Find the JSON output with presence data
      const records = allRecords.filter(
        (r) => r.type === "event" && r.presenceMessage,
      );

      // Verify that presence event was actually output in JSON format
      expect(records.length).toBeGreaterThan(0);
      const parsed = records[0];
      expect(parsed).toHaveProperty("command");
      expect(parsed).toHaveProperty("type", "event");
      const msg = parsed.presenceMessage as Record<string, unknown>;
      expect(msg.action).toBe("leave");
      expect(msg.clientId).toBe("user-456");
      expect(msg.connectionId).toBe("conn-456");
    });
  });

  describe("error handling", () => {
    it("should handle errors gracefully", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.attach.mockRejectedValue(new Error("Connection failed"));

      const { error } = await runCommand(
        ["rooms:presence:subscribe", "test-room"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
