import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblySpaces } from "../../../helpers/mock-ably-spaces.js";
import { getMockAblyRealtime } from "../../../helpers/mock-ably-realtime.js";
import { parseNdjsonLines } from "../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

describe("spaces:subscribe command", () => {
  beforeEach(() => {
    getMockAblyRealtime();
    getMockAblySpaces();
  });

  standardHelpTests("spaces:subscribe", import.meta.url);
  standardArgValidationTests("spaces:subscribe", import.meta.url, {
    requiredArgs: ["test-space"],
  });
  standardFlagTests("spaces:subscribe", import.meta.url, ["--json"]);

  describe("functionality", () => {
    it("should subscribe to both members and locations", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      await runCommand(["spaces:subscribe", "test-space"], import.meta.url);

      expect(space.enter).not.toHaveBeenCalled();
      expect(space.members.subscribe).toHaveBeenCalledWith(
        "update",
        expect.any(Function),
      );
      expect(space.locations.subscribe).toHaveBeenCalledWith(
        "update",
        expect.any(Function),
      );
    });

    it("should output member events with Type label", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      space.members.subscribe.mockImplementation(
        (event: string, cb: (member: unknown) => void) => {
          setTimeout(() => {
            cb({
              clientId: "user-1",
              connectionId: "other-conn-1",
              isConnected: true,
              profileData: { name: "Alice" },
              location: null,
              lastEvent: { name: "enter", timestamp: Date.now() },
            });
          }, 10);
          return Promise.resolve();
        },
      );

      const { stdout } = await runCommand(
        ["spaces:subscribe", "test-space"],
        import.meta.url,
      );

      expect(stdout).toContain("Type:");
      expect(stdout).toContain("member");
      expect(stdout).toContain("Client ID:");
      expect(stdout).toContain("user-1");
      expect(stdout).toContain("Connection ID:");
      expect(stdout).toContain("other-conn-1");
      expect(stdout).toContain("Action:");
      expect(stdout).toContain("enter");
    });

    it("should output location events with Type label", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      let locationHandler: ((update: unknown) => void) | undefined;
      let resolveSubscribed: () => void;
      const subscribed = new Promise<void>((resolve) => {
        resolveSubscribed = resolve;
      });
      space.locations.subscribe.mockImplementation(
        (_event: string, handler: (update: unknown) => void) => {
          locationHandler = handler;
          resolveSubscribed();
        },
      );

      const runPromise = runCommand(
        ["spaces:subscribe", "test-space"],
        import.meta.url,
      );

      await subscribed;

      if (locationHandler) {
        locationHandler({
          member: {
            clientId: "user-2",
            connectionId: "conn-2",
          },
          currentLocation: { room: "lobby" },
          previousLocation: { room: "entrance" },
        });
      }

      const { stdout } = await runPromise;

      expect(stdout).toContain("Type:");
      expect(stdout).toContain("location");
      expect(stdout).toContain("Client ID:");
      expect(stdout).toContain("user-2");
      expect(stdout).toContain("Current Location:");
      expect(stdout).toContain("Previous Location:");
    });

    it("should include eventType in JSON for member events", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      space.members.subscribe.mockImplementation(
        (event: string, cb: (member: unknown) => void) => {
          setTimeout(() => {
            cb({
              clientId: "user-1",
              connectionId: "other-conn-1",
              isConnected: true,
              profileData: { name: "Alice" },
              location: null,
              lastEvent: { name: "enter", timestamp: Date.now() },
            });
          }, 10);
          return Promise.resolve();
        },
      );

      const { stdout } = await runCommand(
        ["spaces:subscribe", "test-space", "--json"],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const eventRecord = records.find(
        (r) => r.type === "event" && r.eventType === "member",
      );
      expect(eventRecord).toBeDefined();
      expect(eventRecord!.member).toBeDefined();
      expect(eventRecord!.member.clientId).toBe("user-1");
    });

    it("should include eventType in JSON for location events", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      let locationHandler: ((update: unknown) => void) | undefined;
      let resolveSubscribed: () => void;
      const subscribed = new Promise<void>((resolve) => {
        resolveSubscribed = resolve;
      });
      space.locations.subscribe.mockImplementation(
        (_event: string, handler: (update: unknown) => void) => {
          locationHandler = handler;
          resolveSubscribed();
        },
      );

      const runPromise = runCommand(
        ["spaces:subscribe", "test-space", "--json"],
        import.meta.url,
      );

      await subscribed;

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
      const eventRecord = records.find(
        (r) => r.type === "event" && r.eventType === "location",
      );
      expect(eventRecord).toBeDefined();
      expect(eventRecord!.location).toBeDefined();
      expect(eventRecord!.location.member.clientId).toBe("user-1");
      expect(eventRecord!.location).toHaveProperty("currentLocation");
      expect(eventRecord!.location).toHaveProperty("previousLocation");
      expect(eventRecord!.location).toHaveProperty("timestamp");
    });
  });

  describe("error handling", () => {
    it("should handle errors gracefully", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.members.subscribe.mockRejectedValue(new Error("Subscribe failed"));

      const { error } = await runCommand(
        ["spaces:subscribe", "test-space"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toContain("Subscribe failed");
    });
  });
});
