import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../../helpers/mock-ably-chat.js";

describe("rooms:reactions:subscribe command", () => {
  beforeEach(() => {
    getMockAblyChat();
  });

  describe("command arguments and flags", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["rooms:reactions:subscribe", "test-room", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should require room argument", async () => {
      const { error } = await runCommand(
        ["rooms:reactions:subscribe"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });
  });

  describe("subscription behavior", () => {
    it("should subscribe to reactions and display them", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");
      const capturedLogs: string[] = [];

      const logSpy = vi.spyOn(console, "log").mockImplementation((msg) => {
        capturedLogs.push(String(msg));
      });

      // Capture the reactions callback
      let reactionsCallback: ((event: unknown) => void) | null = null;
      room.reactions.subscribe.mockImplementation((callback) => {
        reactionsCallback = callback;
        return { unsubscribe: vi.fn() };
      });

      const commandPromise = runCommand(
        ["rooms:reactions:subscribe", "test-room"],
        import.meta.url,
      );

      await vi.waitFor(
        () => {
          expect(room.reactions.subscribe).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );

      // Simulate a reaction event
      if (reactionsCallback) {
        reactionsCallback({
          reaction: {
            name: "heart",
            clientId: "client-123",
            metadata: { color: "red" },
          },
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      process.emit("SIGINT", "SIGINT");

      await commandPromise;

      logSpy.mockRestore();

      // Verify subscription was set up
      expect(chatMock.rooms.get).toHaveBeenCalledWith("test-room");
      expect(room.reactions.subscribe).toHaveBeenCalled();
      expect(room.attach).toHaveBeenCalled();

      // Verify output contains reaction data
      const output = capturedLogs.join("\n");
      expect(output).toContain("heart");
      expect(output).toContain("client-123");
    });

    it("should output JSON format when --json flag is used", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");
      const capturedLogs: string[] = [];

      const logSpy = vi.spyOn(console, "log").mockImplementation((msg) => {
        capturedLogs.push(String(msg));
      });

      // Capture the reactions callback
      let reactionsCallback: ((event: unknown) => void) | null = null;
      room.reactions.subscribe.mockImplementation((callback) => {
        reactionsCallback = callback;
        return { unsubscribe: vi.fn() };
      });

      const commandPromise = runCommand(
        ["rooms:reactions:subscribe", "test-room", "--json"],
        import.meta.url,
      );

      await vi.waitFor(
        () => {
          expect(room.reactions.subscribe).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );

      // Simulate reaction event
      if (reactionsCallback) {
        reactionsCallback({
          reaction: {
            name: "thumbsup",
            clientId: "user1",
            metadata: {},
          },
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      process.emit("SIGINT", "SIGINT");

      await commandPromise;

      logSpy.mockRestore();

      // Verify subscription was set up
      expect(room.reactions.subscribe).toHaveBeenCalled();
      expect(room.attach).toHaveBeenCalled();

      // Find the JSON output with reaction data
      const reactionOutputLines = capturedLogs.filter((line) => {
        try {
          const parsed = JSON.parse(line);
          return parsed.name && parsed.clientId;
        } catch {
          return false;
        }
      });

      // Verify that reaction event was actually output in JSON format
      expect(reactionOutputLines.length).toBeGreaterThan(0);
      const parsed = JSON.parse(reactionOutputLines[0]);
      expect(parsed).toHaveProperty("success", true);
      expect(parsed).toHaveProperty("name", "thumbsup");
      expect(parsed).toHaveProperty("clientId", "user1");
    });
  });
});
