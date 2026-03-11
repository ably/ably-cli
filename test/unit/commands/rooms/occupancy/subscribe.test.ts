import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../../helpers/mock-ably-chat.js";
import { captureJsonLogs } from "../../../../helpers/ndjson.js";

describe("rooms:occupancy:subscribe command", () => {
  beforeEach(() => {
    getMockAblyChat();
  });

  describe("functionality", () => {
    it("should display initial occupancy snapshot", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");
      room.occupancy.get.mockResolvedValue({
        connections: 3,
        presenceMembers: 1,
      });

      const { stdout } = await runCommand(
        ["rooms:occupancy:subscribe", "test-room"],
        import.meta.url,
      );

      expect(room.attach).toHaveBeenCalled();
      expect(room.occupancy.get).toHaveBeenCalled();
      expect(stdout).toContain("Initial occupancy");
      expect(stdout).toContain("Connections: 3");
    });

    it("should warn on initial fetch failure but continue listening", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");
      room.occupancy.get.mockRejectedValue(new Error("Fetch failed"));

      const { stdout } = await runCommand(
        ["rooms:occupancy:subscribe", "test-room"],
        import.meta.url,
      );

      expect(stdout).toContain("Failed to fetch initial occupancy");
      expect(stdout).toContain("Listening");
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

      if (occupancyCallback) {
        occupancyCallback({
          occupancy: { connections: 8, presenceMembers: 4 },
        });
      }

      await commandPromise;
      logSpy.mockRestore();

      expect(room.occupancy.subscribe).toHaveBeenCalled();
    });

    it("should output JSON with type field", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");
      room.occupancy.get.mockResolvedValue({
        connections: 2,
        presenceMembers: 0,
      });

      const allRecords = await captureJsonLogs(async () => {
        await runCommand(
          ["rooms:occupancy:subscribe", "test-room", "--json"],
          import.meta.url,
        );
      });

      // Find the JSON output with initial snapshot
      const records = allRecords.filter(
        (r) => r.type === "event" && r.eventType === "initialSnapshot",
      );

      expect(records.length).toBeGreaterThan(0);
      const parsed = records[0];
      expect(parsed).toHaveProperty("type", "event");
      expect(parsed).toHaveProperty("eventType", "initialSnapshot");
      expect(parsed).toHaveProperty("room", "test-room");
    });
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["rooms:occupancy:subscribe", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("USAGE");
    });
  });

  describe("argument validation", () => {
    it("should require room argument", async () => {
      const { error } = await runCommand(
        ["rooms:occupancy:subscribe"],
        import.meta.url,
      );
      expect(error?.message).toMatch(/room|required|Missing/i);
    });
  });

  describe("flags", () => {
    it("should accept --json flag", async () => {
      const { stdout } = await runCommand(
        ["rooms:occupancy:subscribe", "--help"],
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
        ["rooms:occupancy:subscribe", "test-room"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
