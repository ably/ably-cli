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

describe("spaces:members:get command", () => {
  beforeEach(() => {
    getMockAblyRealtime();
    getMockAblySpaces();
  });

  standardHelpTests("spaces:members:get", import.meta.url);
  standardArgValidationTests("spaces:members:get", import.meta.url, {
    requiredArgs: ["test-space"],
  });
  standardFlagTests("spaces:members:get", import.meta.url, ["--json"]);

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
          lastEvent: { name: "enter", timestamp: Date.now() },
        },
      ]);

      const { stdout } = await runCommand(
        ["spaces:members:get", "test-space", "--json"],
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
          location: null,
          lastEvent: { name: "enter", timestamp: Date.now() },
        },
      ]);

      const { stdout } = await runCommand(
        ["spaces:members:get", "test-space", "--json"],
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
      expect(resultRecord!.members[0]).toHaveProperty("clientId", "user-1");
      expect(resultRecord!.members[0]).toHaveProperty("connectionId", "conn-1");
    });

    it("should handle no members found", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.members.getAll.mockResolvedValue([]);

      const { stdout } = await runCommand(
        ["spaces:members:get", "test-space", "--json"],
        import.meta.url,
      );

      expect(stdout).toContain("members");
    });

    it("should display non-JSON output with member blocks", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.members.getAll.mockResolvedValue([
        {
          clientId: "user-1",
          connectionId: "conn-1",
          isConnected: true,
          profileData: { name: "Alice" },
          location: null,
          lastEvent: { name: "enter", timestamp: Date.now() },
        },
      ]);

      const { stdout } = await runCommand(
        ["spaces:members:get", "test-space"],
        import.meta.url,
      );

      expect(stdout).toContain("Current members");
      expect(stdout).toContain("Client ID:");
      expect(stdout).toContain("user-1");
      expect(stdout).toContain("Connection ID:");
      expect(stdout).toContain("conn-1");
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
        ["spaces:members:get", "test-space"],
        import.meta.url,
      );
      expect(error).toBeDefined();
    });
  });
});
