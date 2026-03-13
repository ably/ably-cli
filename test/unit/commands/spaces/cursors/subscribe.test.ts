import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblySpaces } from "../../../../helpers/mock-ably-spaces.js";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";
import { parseNdjsonLines } from "../../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("spaces:cursors:subscribe command", () => {
  beforeEach(() => {
    // Initialize the mocks
    getMockAblyRealtime();
    getMockAblySpaces();
  });

  standardHelpTests("spaces:cursors:subscribe", import.meta.url);
  standardArgValidationTests("spaces:cursors:subscribe", import.meta.url, {
    requiredArgs: ["test-space"],
  });
  standardFlagTests("spaces:cursors:subscribe", import.meta.url, ["--json"]);

  describe("functionality", () => {
    it("should subscribe to cursor updates in a space", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.cursors.getAll.mockResolvedValue({});

      await runCommand(
        ["spaces:cursors:subscribe", "test-space"],
        import.meta.url,
      );

      expect(space.enter).toHaveBeenCalled();
      expect(space.cursors.subscribe).toHaveBeenCalledWith(
        "update",
        expect.any(Function),
      );
    });

    it("should display initial subscription message", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.cursors.getAll.mockResolvedValue({});

      const { stdout } = await runCommand(
        ["spaces:cursors:subscribe", "test-space"],
        import.meta.url,
      );

      expect(stdout).toContain("Subscribing");
      expect(stdout).toContain("test-space");
    });
  });

  describe("cleanup behavior", () => {
    it("should close client on completion", async () => {
      const realtimeMock = getMockAblyRealtime();
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.cursors.getAll.mockResolvedValue({});

      // Use SIGINT to exit

      await runCommand(
        ["spaces:cursors:subscribe", "test-space"],
        import.meta.url,
      );

      // Verify close was called during cleanup (either by performCleanup or finally block)
      expect(realtimeMock.close).toHaveBeenCalled();
    });
  });

  describe("JSON output", () => {
    it("should output JSON event with envelope when cursor update is received", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.cursors.getAll.mockResolvedValue({});

      // Fire a cursor event synchronously when subscribe is called
      space.cursors.subscribe.mockImplementation(
        (_event: string, callback: (update: unknown) => void) => {
          // Fire the callback synchronously to produce JSON output
          callback({
            clientId: "user-1",
            connectionId: "conn-1",
            position: { x: 50, y: 75 },
            data: { color: "red" },
          });
        },
      );

      const { stdout } = await runCommand(
        ["spaces:cursors:subscribe", "test-space", "--json"],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const eventRecords = records.filter(
        (r) => r.type === "event" && r.eventType === "cursor_update",
      );
      expect(eventRecords.length).toBeGreaterThan(0);
      const event = eventRecords[0];
      expect(event).toHaveProperty("command");
      expect(event).toHaveProperty("spaceName", "test-space");
      expect(event).toHaveProperty("position");
    });
  });

  describe("channel attachment", () => {
    it("should wait for cursors channel to attach if not already attached", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.cursors.getAll.mockResolvedValue({});

      // Mock channel as attaching
      space.cursors.channel.state = "attaching";
      space.cursors.channel.on.mockImplementation(
        (event: string, callback: () => void) => {
          if (event === "attached") {
            // Simulate channel attaching shortly after
            setTimeout(() => callback(), 50);
          }
        },
      );

      await runCommand(
        ["spaces:cursors:subscribe", "test-space"],
        import.meta.url,
      );

      // Verify the command registered for attachment events
      expect(space.cursors.channel.on).toHaveBeenCalledWith(
        "attached",
        expect.any(Function),
      );
    });
  });

  describe("error handling", () => {
    it("should handle space entry failure", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.enter.mockRejectedValue(new Error("Connection failed"));

      const { error } = await runCommand(
        ["spaces:cursors:subscribe", "test-space"],
        import.meta.url,
      );
      expect(error).toBeDefined();
    });
  });
});
