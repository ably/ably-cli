import { describe, it, expect, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { RoomStatus } from "@ably/chat";
import { getMockAblyChat } from "../../../../helpers/mock-ably-chat.js";

describe("rooms:typing:subscribe command", () => {
  describe("command arguments and flags", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["rooms:typing:subscribe", "test-room", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should require room argument", async () => {
      const { error } = await runCommand(
        ["rooms:typing:subscribe"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });
  });

  describe("subscription behavior", () => {
    it("should subscribe to typing events and display them", async () => {
      const mock = getMockAblyChat();
      const room = mock.rooms._getRoom("test-room");

      // Capture the typing callback when subscribe is called
      let typingCallback: ((event: unknown) => void) | null = null;
      room.typing.subscribe.mockImplementation((callback) => {
        typingCallback = callback;
        return { unsubscribe: vi.fn() };
      });

      // Configure attach to emit the status change
      room.attach.mockImplementation(async () => {
        room.status = RoomStatus.Attached;
      });

      // Run command in background
      const commandPromise = runCommand(
        ["rooms:typing:subscribe", "test-room"],
        import.meta.url,
      );

      // Wait for subscription to be set up
      await vi.waitFor(
        () => {
          expect(room.typing.subscribe).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );

      // Simulate a typing event
      if (typingCallback) {
        typingCallback({
          currentlyTyping: new Set(["user1", "user2"]),
        });
      }

      // Give time for output to be generated

      // Simulate Ctrl+C to stop the command

      const result = await commandPromise;

      // Verify subscription was set up
      expect(mock.rooms.get).toHaveBeenCalledWith("test-room");
      expect(room.typing.subscribe).toHaveBeenCalled();
      expect(room.attach).toHaveBeenCalled();

      // Verify output contains typing notification
      expect(result.stdout).toContain("user1");
      expect(result.stdout).toContain("user2");
      expect(result.stdout).toContain("typing");
    });

    it("should output JSON format when --json flag is used", async () => {
      const mock = getMockAblyChat();
      const room = mock.rooms._getRoom("test-room");
      const capturedLogs: string[] = [];

      // Spy on console.log to capture output
      const logSpy = vi.spyOn(console, "log").mockImplementation((msg) => {
        capturedLogs.push(String(msg));
      });

      // Capture the typing callback when subscribe is called
      let typingCallback: ((event: unknown) => void) | null = null;
      room.typing.subscribe.mockImplementation((callback) => {
        typingCallback = callback;
        return { unsubscribe: vi.fn() };
      });

      // Configure attach to emit the status change
      room.attach.mockImplementation(async () => {
        room.status = RoomStatus.Attached;
      });

      const commandPromise = runCommand(
        ["rooms:typing:subscribe", "test-room", "--json"],
        import.meta.url,
      );

      await vi.waitFor(
        () => {
          expect(room.typing.subscribe).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );

      // Simulate typing event
      if (typingCallback) {
        typingCallback({
          currentlyTyping: new Set(["user1"]),
        });
      }

      // Wait for output to be generated

      await commandPromise;

      // Restore spy
      logSpy.mockRestore();

      // Verify subscription was set up
      expect(room.typing.subscribe).toHaveBeenCalled();
      expect(room.attach).toHaveBeenCalled();

      // Find the JSON output with typing data from captured logs
      const typingOutputLines = capturedLogs.filter((line) => {
        try {
          const parsed = JSON.parse(line);
          return (
            parsed.currentlyTyping && Array.isArray(parsed.currentlyTyping)
          );
        } catch {
          return false;
        }
      });

      // Verify that typing event was actually output in JSON format
      expect(typingOutputLines.length).toBeGreaterThan(0);
      const parsed = JSON.parse(typingOutputLines[0]);
      expect(parsed).toHaveProperty("success", true);
      expect(parsed.currentlyTyping).toContain("user1");
    });
  });
});
