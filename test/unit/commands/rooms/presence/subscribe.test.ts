import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../../helpers/mock-ably-chat.js";

describe("rooms:presence:subscribe command", () => {
  beforeEach(() => {
    getMockAblyChat();
  });

  describe("command arguments and flags", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["rooms:presence:subscribe", "test-room", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should require room argument", async () => {
      const { error } = await runCommand(
        ["rooms:presence:subscribe"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });
  });

  describe("subscription behavior", () => {
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
      if (presenceCallback) {
        presenceCallback({
          type: "enter",
          member: {
            clientId: "user-123",
            data: { name: "Test User" },
          },
        });
      }

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
            data: {},
          },
        });
      }

      await commandPromise;

      logSpy.mockRestore();

      // Verify subscription was set up
      expect(room.presence.subscribe).toHaveBeenCalled();
      expect(room.attach).toHaveBeenCalled();

      // Find the JSON output with presence data
      const presenceOutputLines = capturedLogs.filter((line) => {
        try {
          const parsed = JSON.parse(line);
          return parsed.type && parsed.member && parsed.member.clientId;
        } catch {
          return false;
        }
      });

      // Verify that presence event was actually output in JSON format
      expect(presenceOutputLines.length).toBeGreaterThan(0);
      const parsed = JSON.parse(presenceOutputLines[0]);
      expect(parsed).toHaveProperty("success", true);
      expect(parsed).toHaveProperty("type", "leave");
      expect(parsed.member).toHaveProperty("clientId", "user-456");
    });
  });
});
