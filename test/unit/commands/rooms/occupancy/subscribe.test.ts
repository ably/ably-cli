import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../../helpers/mock-ably-chat.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("rooms:occupancy:subscribe command", () => {
  beforeEach(() => {
    getMockAblyChat();
  });

  standardHelpTests("rooms:occupancy:subscribe", import.meta.url);
  standardArgValidationTests("rooms:occupancy:subscribe", import.meta.url, {
    requiredArgs: ["test-room"],
  });
  standardFlagTests("rooms:occupancy:subscribe", import.meta.url, ["--json"]);

  describe("functionality", () => {
    it("should attach and subscribe to occupancy events", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      const { stderr } = await runCommand(
        ["rooms:occupancy:subscribe", "test-room"],
        import.meta.url,
      );

      expect(room.attach).toHaveBeenCalled();
      expect(room.occupancy.subscribe).toHaveBeenCalled();
      expect(stderr).toContain("Subscribed to occupancy in room");
    });

    it("should display listening message", async () => {
      const chatMock = getMockAblyChat();
      chatMock.rooms._getRoom("test-room");

      const { stderr } = await runCommand(
        ["rooms:occupancy:subscribe", "test-room"],
        import.meta.url,
      );

      expect(stderr).toContain("Listening");
    });

    it("should subscribe and display updates", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");
      const capturedLogs: string[] = [];

      const logSpy = vi.spyOn(console, "log").mockImplementation((msg) => {
        capturedLogs.push(String(msg));
      });

      let occupancyCallback: ((event: unknown) => void) | null = null;
      room.occupancy.subscribe.mockImplementation((callback) => {
        occupancyCallback = callback;
        return { unsubscribe: vi.fn() };
      });

      const commandPromise = runCommand(
        ["rooms:occupancy:subscribe", "test-room"],
        import.meta.url,
      );

      await vi.waitFor(
        () => {
          expect(room.occupancy.subscribe).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );

      occupancyCallback!({
        occupancy: { connections: 8, presenceMembers: 4 },
      });

      await commandPromise;
      logSpy.mockRestore();

      expect(room.occupancy.subscribe).toHaveBeenCalled();
    });

    it("should run with --json flag without errors", async () => {
      const chatMock = getMockAblyChat();
      chatMock.rooms._getRoom("test-room");

      const { error } = await runCommand(
        ["rooms:occupancy:subscribe", "test-room", "--json"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("should handle errors gracefully", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");

      room.attach.mockRejectedValue(new Error("Connection failed"));

      const { error } = await runCommand(
        ["rooms:occupancy:subscribe", "test-room"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
