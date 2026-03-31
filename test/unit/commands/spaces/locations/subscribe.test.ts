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

describe("spaces:locations:subscribe command", () => {
  beforeEach(() => {
    // Initialize the mocks
    getMockAblyRealtime();
    getMockAblySpaces();
  });

  standardHelpTests("spaces:locations:subscribe", import.meta.url);
  standardArgValidationTests("spaces:locations:subscribe", import.meta.url, {
    requiredArgs: ["test-space"],
  });
  standardFlagTests("spaces:locations:subscribe", import.meta.url, ["--json"]);

  describe("functionality", () => {
    it("should subscribe to location updates in a space", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      await runCommand(
        ["spaces:locations:subscribe", "test-space"],
        import.meta.url,
      );

      expect(space.enter).not.toHaveBeenCalled();
      expect(space.locations.subscribe).toHaveBeenCalledWith(
        "update",
        expect.any(Function),
      );
    });

    it("should display initial subscription message without fetching current locations", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      const { stderr } = await runCommand(
        ["spaces:locations:subscribe", "test-space"],
        import.meta.url,
      );

      expect(stderr).toContain("Subscribing to location updates");
      expect(space.locations.getAll).not.toHaveBeenCalled();
    });

    it("should output location updates in block format", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      // Capture the subscribe handler and invoke it with a mock update
      let locationHandler: ((update: unknown) => void) | undefined;
      space.locations.subscribe.mockImplementation(
        (_event: string, handler: (update: unknown) => void) => {
          locationHandler = handler;
        },
      );

      const runPromise = runCommand(
        ["spaces:locations:subscribe", "test-space"],
        import.meta.url,
      );

      // Wait a tick for the subscribe to be set up
      await new Promise((resolve) => setTimeout(resolve, 50));

      if (locationHandler) {
        locationHandler({
          member: {
            clientId: "user-1",
            connectionId: "conn-1",
          },
          currentLocation: { room: "lobby" },
          previousLocation: { room: "entrance" },
        });
      }

      const { stdout } = await runPromise;

      expect(stdout).toContain("Client ID:");
      expect(stdout).toContain("Connection ID:");
      expect(stdout).toContain("Current Location:");
      expect(stdout).toContain("Previous Location:");
    });
  });

  describe("JSON output", () => {
    it("should output JSON event envelope for location updates", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      let locationHandler: ((update: unknown) => void) | undefined;
      space.locations.subscribe.mockImplementation(
        (_event: string, handler: (update: unknown) => void) => {
          locationHandler = handler;
        },
      );

      const runPromise = runCommand(
        ["spaces:locations:subscribe", "test-space", "--json"],
        import.meta.url,
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      if (locationHandler) {
        locationHandler({
          member: {
            clientId: "user-1",
            connectionId: "conn-1",
          },
          currentLocation: { room: "lobby" },
          previousLocation: null,
        });
      }

      const { stdout } = await runPromise;

      const records = parseNdjsonLines(stdout);
      const eventRecord = records.find((r) => r.type === "event" && r.location);
      expect(eventRecord).toBeDefined();
      expect(eventRecord).toHaveProperty("command");
      expect(eventRecord!.location).toHaveProperty("member");
      expect(eventRecord!.location.member).toHaveProperty("clientId", "user-1");
      expect(eventRecord!.location).toHaveProperty("currentLocation");
      expect(eventRecord!.location).toHaveProperty("previousLocation");
    });
  });

  describe("cleanup behavior", () => {
    it("should close client on completion", async () => {
      const realtimeMock = getMockAblyRealtime();
      getMockAblySpaces();

      // Use SIGINT to exit

      await runCommand(
        ["spaces:locations:subscribe", "test-space"],
        import.meta.url,
      );

      // Verify close was called during cleanup
      expect(realtimeMock.close).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle subscribe error gracefully", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locations.subscribe.mockImplementation(() => {
        throw new Error("Failed to subscribe to locations");
      });

      const { error } = await runCommand(
        ["spaces:locations:subscribe", "test-space"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Failed to subscribe to locations");
    });
  });
});
