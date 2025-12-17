import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../../../helpers/mock-ably-chat.js";

describe("rooms:messages:reactions:subscribe command", () => {
  beforeEach(() => {
    getMockAblyChat();
  });

  describe("command arguments and flags", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["rooms:messages:reactions:subscribe", "test-room", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should require room argument", async () => {
      const { error } = await runCommand(
        ["rooms:messages:reactions:subscribe"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });
  });

  describe("subscription behavior", () => {
    it("should subscribe to message reactions and display them", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");
      const capturedLogs: string[] = [];

      const logSpy = vi.spyOn(console, "log").mockImplementation((msg) => {
        capturedLogs.push(String(msg));
      });

      // Capture the message reactions callback
      let reactionsCallback: ((event: unknown) => void) | null = null;
      room.messages.reactions.subscribe.mockImplementation((callback) => {
        reactionsCallback = callback;
        return () => {}; // unsubscribe function
      });

      const commandPromise = runCommand(
        ["rooms:messages:reactions:subscribe", "test-room"],
        import.meta.url,
      );

      await vi.waitFor(
        () => {
          expect(room.messages.reactions.subscribe).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );

      // Simulate a message reaction summary event
      if (reactionsCallback) {
        reactionsCallback({
          messageSerial: "msg-123",
          reactions: {
            unique: {
              like: { total: 1, clientIds: ["user1"] },
            },
            distinct: {
              like: { total: 1, clientIds: ["user1"] },
            },
          },
        });
      }

      await commandPromise;

      logSpy.mockRestore();

      // Verify subscription was set up
      expect(chatMock.rooms.get).toHaveBeenCalled();
      expect(room.messages.reactions.subscribe).toHaveBeenCalled();
      expect(room.attach).toHaveBeenCalled();

      // Verify output contains reaction data
      const output = capturedLogs.join("\n");
      expect(output).toContain("msg-123");
      expect(output).toContain("like");
    });

    it("should output JSON format when --json flag is used", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");
      const capturedLogs: string[] = [];

      const logSpy = vi.spyOn(console, "log").mockImplementation((msg) => {
        capturedLogs.push(String(msg));
      });

      // Capture the message reactions callback
      let reactionsCallback: ((event: unknown) => void) | null = null;
      room.messages.reactions.subscribe.mockImplementation((callback) => {
        reactionsCallback = callback;
        return () => {};
      });

      const commandPromise = runCommand(
        ["rooms:messages:reactions:subscribe", "test-room", "--json"],
        import.meta.url,
      );

      await vi.waitFor(
        () => {
          expect(room.messages.reactions.subscribe).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );

      // Simulate message reaction summary event
      if (reactionsCallback) {
        reactionsCallback({
          messageSerial: "msg-456",
          reactions: {
            unique: {
              heart: { total: 2, clientIds: ["user1", "user2"] },
            },
            distinct: {
              heart: { total: 2, clientIds: ["user1", "user2"] },
            },
          },
        });
      }

      await commandPromise;

      logSpy.mockRestore();

      // Verify subscription was set up
      expect(room.messages.reactions.subscribe).toHaveBeenCalled();
      expect(room.attach).toHaveBeenCalled();

      // Find the JSON output with reaction summary data
      const reactionOutputLines = capturedLogs.filter((line) => {
        try {
          const parsed = JSON.parse(line);
          return parsed.summary && parsed.room;
        } catch {
          return false;
        }
      });

      // Verify that reaction summary was actually output in JSON format
      expect(reactionOutputLines.length).toBeGreaterThan(0);
      const parsed = JSON.parse(reactionOutputLines[0]);
      expect(parsed).toHaveProperty("success", true);
      expect(parsed).toHaveProperty("room", "test-room");
      expect(parsed.summary).toHaveProperty("unique");
      expect(parsed.summary.unique).toHaveProperty("heart");
    });
  });
});
