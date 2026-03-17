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

describe("spaces:members:get-all command", () => {
  beforeEach(() => {
    getMockAblyRealtime();
    getMockAblySpaces();
  });

  standardHelpTests("spaces:members:get-all", import.meta.url);
  standardArgValidationTests("spaces:members:get-all", import.meta.url, {
    requiredArgs: ["test-space"],
  });
  standardFlagTests("spaces:members:get-all", import.meta.url, ["--json"]);

  describe("functionality", () => {
    it("should get all members from a space", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.members.getAll.mockResolvedValue([
        {
          clientId: "user-1",
          connectionId: "conn-1",
          isConnected: true,
          profileData: { name: "Alice" },
          location: null,
          lastEvent: { name: "enter", timestamp: 1710000000000 },
        },
      ]);

      const { stdout } = await runCommand(
        ["spaces:members:get-all", "test-space", "--json"],
        import.meta.url,
      );

      expect(space.enter).not.toHaveBeenCalled();
      expect(space.members.getAll).toHaveBeenCalled();
      expect(stdout).toContain("members");
    });

    it("should output JSON envelope with type and command for member results", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.members.getAll.mockResolvedValue([
        {
          clientId: "user-1",
          connectionId: "conn-1",
          isConnected: true,
          profileData: { name: "Alice" },
          location: { slide: 1 },
          lastEvent: { name: "enter", timestamp: 1710000000000 },
        },
        {
          clientId: "user-2",
          connectionId: "conn-2",
          isConnected: true,
          profileData: null,
          location: null,
          lastEvent: { name: "enter", timestamp: 1710000001000 },
        },
      ]);

      const { stdout } = await runCommand(
        ["spaces:members:get-all", "test-space", "--json"],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const resultRecord = records.find(
        (r) => r.type === "result" && Array.isArray(r.members),
      );
      expect(resultRecord).toBeDefined();
      expect(resultRecord).toHaveProperty("type", "result");
      expect(resultRecord).toHaveProperty("command");
      expect(resultRecord).toHaveProperty("success", true);
      expect(resultRecord!.members).toBeInstanceOf(Array);
      expect((resultRecord!.members as unknown[]).length).toBe(2);
      expect(
        (resultRecord!.members as Record<string, unknown>[])[0],
      ).toHaveProperty("clientId", "user-1");
    });

    it("should handle no members found", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.members.getAll.mockResolvedValue([]);

      const { stdout } = await runCommand(
        ["spaces:members:get-all", "test-space"],
        import.meta.url,
      );

      expect(stdout).toContain("No members currently in this space");
    });

    it("should display members in human-readable format", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.members.getAll.mockResolvedValue([
        {
          clientId: "user-1",
          connectionId: "conn-1",
          isConnected: true,
          profileData: { name: "Alice" },
          location: null,
          lastEvent: { name: "enter", timestamp: 1710000000000 },
        },
      ]);

      const { stdout } = await runCommand(
        ["spaces:members:get-all", "test-space"],
        import.meta.url,
      );

      expect(stdout).toContain("Current members");
      expect(stdout).toContain("Client ID:");
      expect(stdout).toContain("user-1");
      expect(stdout).toContain("Connection ID:");
      expect(stdout).toContain("conn-1");
      expect(stdout).toContain("Connected:");
    });
  });

  describe("error handling", () => {
    it("should handle errors gracefully", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.members.getAll.mockRejectedValue(
        new Error("Failed to get members"),
      );

      const { error } = await runCommand(
        ["spaces:members:get-all", "test-space"],
        import.meta.url,
      );
      expect(error).toBeDefined();
    });
  });
});
