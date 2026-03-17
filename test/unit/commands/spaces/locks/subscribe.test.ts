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

describe("spaces:locks:subscribe command", () => {
  beforeEach(() => {
    // Initialize the mocks
    getMockAblyRealtime();
    getMockAblySpaces();
  });

  standardHelpTests("spaces:locks:subscribe", import.meta.url);
  standardArgValidationTests("spaces:locks:subscribe", import.meta.url, {
    requiredArgs: ["test-space"],
  });
  standardFlagTests("spaces:locks:subscribe", import.meta.url, ["--json"]);

  describe("functionality", () => {
    it("should subscribe to lock events in a space", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      await runCommand(
        ["spaces:locks:subscribe", "test-space"],
        import.meta.url,
      );

      expect(space.enter).not.toHaveBeenCalled();
      expect(space.locks.subscribe).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should display listening message without fetching initial locks", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      const { stdout } = await runCommand(
        ["spaces:locks:subscribe", "test-space"],
        import.meta.url,
      );

      expect(stdout).toContain("Subscribing to lock events");
      expect(space.locks.getAll).not.toHaveBeenCalled();
    });

    it("should output lock events using block format", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      // Capture the subscribe callback and invoke it with a lock event
      space.locks.subscribe.mockImplementation(
        (callback: (lock: unknown) => void) => {
          callback({
            id: "lock-1",
            status: "locked",
            member: {
              clientId: "user-1",
              connectionId: "conn-1",
              isConnected: true,
              profileData: null,
              location: null,
              lastEvent: { name: "enter", timestamp: Date.now() },
            },
            timestamp: Date.now(),
            attributes: undefined,
            reason: undefined,
          });
          return Promise.resolve();
        },
      );

      const { stdout } = await runCommand(
        ["spaces:locks:subscribe", "test-space"],
        import.meta.url,
      );

      expect(stdout).toContain("Lock ID:");
      expect(stdout).toContain("lock-1");
      expect(stdout).toContain("Status:");
      expect(stdout).toContain("locked");
      expect(stdout).toContain("Member:");
      expect(stdout).toContain("user-1");
    });
  });

  describe("JSON output", () => {
    it("should output JSON event envelope for lock events", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      // Capture the subscribe callback and invoke it with a lock event
      space.locks.subscribe.mockImplementation(
        (callback: (lock: unknown) => void) => {
          callback({
            id: "lock-1",
            status: "locked",
            member: {
              clientId: "user-1",
              connectionId: "conn-1",
              isConnected: true,
              profileData: null,
              location: null,
              lastEvent: { name: "enter", timestamp: Date.now() },
            },
            timestamp: Date.now(),
            attributes: undefined,
            reason: undefined,
          });
          return Promise.resolve();
        },
      );

      const { stdout } = await runCommand(
        ["spaces:locks:subscribe", "test-space", "--json"],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const eventRecord = records.find((r) => r.type === "event" && r.lock);
      expect(eventRecord).toBeDefined();
      expect(eventRecord).toHaveProperty("type", "event");
      expect(eventRecord).toHaveProperty("command");
      expect(eventRecord!.lock).toHaveProperty("id", "lock-1");
      expect(eventRecord!.lock).toHaveProperty("status", "locked");
      expect(eventRecord!.lock).toHaveProperty("member");
    });
  });

  describe("cleanup behavior", () => {
    it("should close client on completion", async () => {
      const realtimeMock = getMockAblyRealtime();
      getMockAblySpaces();

      await runCommand(
        ["spaces:locks:subscribe", "test-space"],
        import.meta.url,
      );

      // Verify close was called during cleanup
      expect(realtimeMock.close).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle subscribe rejection gracefully", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.subscribe.mockRejectedValue(
        new Error("Failed to subscribe to locks"),
      );

      const { error } = await runCommand(
        ["spaces:locks:subscribe", "test-space"],
        import.meta.url,
      );

      // Command should have attempted to run and reported the error
      expect(error).toBeDefined();
    });
  });
});
