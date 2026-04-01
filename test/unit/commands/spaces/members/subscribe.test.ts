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

describe("spaces:members:subscribe command", () => {
  beforeEach(() => {
    getMockAblyRealtime();
    getMockAblySpaces();
  });

  standardHelpTests("spaces:members:subscribe", import.meta.url);
  standardArgValidationTests("spaces:members:subscribe", import.meta.url, {
    requiredArgs: ["test-space"],
  });
  standardFlagTests("spaces:members:subscribe", import.meta.url, ["--json"]);

  describe("functionality", () => {
    it("should subscribe to member events and output in block format", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      // Emit a member event after subscription is set up
      space.members.subscribe.mockImplementation(
        (event: string, cb: (member: unknown) => void) => {
          // Fire the callback asynchronously to simulate an incoming event
          setTimeout(() => {
            cb({
              clientId: "user-1",
              connectionId: "other-conn-1",
              isConnected: true,
              profileData: { name: "Alice" },
              location: null,
              lastEvent: { name: "update", timestamp: Date.now() },
            });
          }, 10);
          return Promise.resolve();
        },
      );

      const { stdout } = await runCommand(
        ["spaces:members:subscribe", "test-space"],
        import.meta.url,
      );

      expect(stdout).toContain("Action:");
      expect(stdout).toContain("update");
      expect(stdout).toContain("Client ID:");
      expect(stdout).toContain("user-1");
      expect(stdout).toContain("Connection ID:");
      expect(stdout).toContain("other-conn-1");
      expect(stdout).toContain("Connected:");
    });
  });

  describe("subscription behavior", () => {
    it("should subscribe to member update events", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      await runCommand(
        ["spaces:members:subscribe", "test-space"],
        import.meta.url,
      );

      expect(space.enter).not.toHaveBeenCalled();
      expect(space.members.subscribe).toHaveBeenCalledWith(
        "update",
        expect.any(Function),
      );
    });
  });

  describe("JSON output", () => {
    it("should output JSON event for member updates", async () => {
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
              lastEvent: { name: "update", timestamp: Date.now() },
            });
          }, 10);
          return Promise.resolve();
        },
      );

      const { stdout } = await runCommand(
        ["spaces:members:subscribe", "test-space", "--json"],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const result = records.find((r) => r.type === "event");
      expect(result).toBeDefined();
      expect(result!.member).toBeDefined();
      expect(result!.member.clientId).toBe("user-1");
    });
  });

  describe("error handling", () => {
    it("should handle errors gracefully", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.members.subscribe.mockImplementation(() => {
        throw new Error("Connection failed");
      });

      const { error } = await runCommand(
        ["spaces:members:subscribe", "test-space"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toContain("Connection failed");
    });
  });
});
