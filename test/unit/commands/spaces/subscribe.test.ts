import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblySpaces } from "../../../helpers/mock-ably-spaces.js";
import { getMockAblyRealtime } from "../../../helpers/mock-ably-realtime.js";
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
    it("should subscribe to space update events and output in block format", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      space.subscribe.mockImplementation(
        (event: string, cb: (state: unknown) => void) => {
          setTimeout(() => {
            cb({
              members: [
                {
                  clientId: "user-1",
                  connectionId: "conn-1",
                  isConnected: true,
                  profileData: { name: "Alice" },
                  location: null,
                  lastEvent: { name: "enter", timestamp: Date.now() },
                },
              ],
            });
          }, 10);
        },
      );

      const { stdout } = await runCommand(
        ["spaces:subscribe", "test-space"],
        import.meta.url,
      );

      expect(stdout).toContain("Space update");
      expect(stdout).toContain("Client ID:");
      expect(stdout).toContain("user-1");
      expect(stdout).toContain("Connection ID:");
      expect(stdout).toContain("conn-1");
    });

    it("should subscribe to update events without entering space", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      await runCommand(["spaces:subscribe", "test-space"], import.meta.url);

      expect(space.enter).not.toHaveBeenCalled();
      expect(space.subscribe).toHaveBeenCalledWith(
        "update",
        expect.any(Function),
      );
    });
  });

  describe("JSON output", () => {
    it("should output JSON event for space updates", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      space.subscribe.mockImplementation(
        (event: string, cb: (state: unknown) => void) => {
          setTimeout(() => {
            cb({
              members: [
                {
                  clientId: "user-1",
                  connectionId: "conn-1",
                  isConnected: true,
                  profileData: { name: "Alice" },
                  location: null,
                  lastEvent: { name: "enter", timestamp: 1710000000000 },
                },
              ],
            });
          }, 10);
        },
      );

      const { stdout } = await runCommand(
        ["spaces:subscribe", "test-space", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result.type).toBe("event");
      expect(result.members).toBeDefined();
      expect(result.members).toBeInstanceOf(Array);
      expect(result.members[0].clientId).toBe("user-1");
    });
  });

  describe("error handling", () => {
    it("should handle subscription errors gracefully", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.subscribe.mockImplementation(() => {
        throw new Error("Subscription failed");
      });

      const { error } = await runCommand(
        ["spaces:subscribe", "test-space"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toContain("Subscription failed");
    });
  });
});
