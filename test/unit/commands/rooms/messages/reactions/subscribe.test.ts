import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../../../helpers/mock-ably-chat.js";
import { captureJsonLogs } from "../../../../../helpers/ndjson.js";

describe("rooms:messages:reactions:subscribe command", () => {
  beforeEach(() => {
    getMockAblyChat();
  });

  describe("argument validation", () => {
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

  describe("functionality", () => {
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

      // Capture the message reactions callback
      let reactionsCallback: ((event: unknown) => void) | null = null;
      room.messages.reactions.subscribe.mockImplementation((callback) => {
        reactionsCallback = callback;
        return () => {};
      });

      const allRecords = await captureJsonLogs(async () => {
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
      });

      // Verify subscription was set up
      expect(room.messages.reactions.subscribe).toHaveBeenCalled();
      expect(room.attach).toHaveBeenCalled();

      // Find the JSON output with reaction summary data
      const records = allRecords.filter(
        (r) => r.type === "event" && r.summary && r.room,
      );

      // Verify that reaction summary was actually output in JSON format
      expect(records.length).toBeGreaterThan(0);
      const parsed = records[0];
      expect(parsed).toHaveProperty("command");
      expect(parsed).toHaveProperty("type", "event");
      expect(parsed).toHaveProperty("room", "test-room");
      expect(parsed.summary).toHaveProperty("unique");
      expect(parsed.summary.unique).toHaveProperty("heart");
    });
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["rooms:messages:reactions:subscribe", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("USAGE");
    });
  });

  describe("flags", () => {
    it("should accept --json flag", async () => {
      const { stdout } = await runCommand(
        ["rooms:messages:reactions:subscribe", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("--json");
    });
  });

  describe("error handling", () => {
    it("should handle errors gracefully", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.attach.mockRejectedValue(new Error("Connection failed"));

      const { error } = await runCommand(
        ["rooms:messages:reactions:subscribe", "test-room"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
