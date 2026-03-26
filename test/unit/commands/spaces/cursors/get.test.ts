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

describe("spaces:cursors:get command", () => {
  beforeEach(() => {
    // Initialize the mocks
    getMockAblyRealtime();
    getMockAblySpaces();
  });

  standardHelpTests("spaces:cursors:get", import.meta.url);
  standardArgValidationTests("spaces:cursors:get", import.meta.url, {
    requiredArgs: ["test-space"],
  });
  standardFlagTests("spaces:cursors:get", import.meta.url, ["--json"]);

  describe("functionality", () => {
    it("should get all cursors from a space", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.cursors.getAll.mockResolvedValue({
        "conn-1": {
          clientId: "user-1",
          connectionId: "conn-1",
          position: { x: 100, y: 200 },
          data: { color: "red" },
        },
        "conn-2": {
          clientId: "user-2",
          connectionId: "conn-2",
          position: { x: 300, y: 400 },
          data: { color: "blue" },
        },
      });

      const { stdout } = await runCommand(
        ["spaces:cursors:get", "test-space", "--json"],
        import.meta.url,
      );

      expect(space.enter).not.toHaveBeenCalled();
      expect(space.cursors.getAll).toHaveBeenCalled();

      // The command outputs JSON with cursors array
      expect(stdout).toContain("cursors");
      expect(stdout).toContain("success");
    });

    it("should handle no cursors found", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.cursors.getAll.mockResolvedValue({});

      const { stdout } = await runCommand(
        ["spaces:cursors:get", "test-space", "--json"],
        import.meta.url,
      );

      // The command outputs multiple JSON lines, last one has cursors array
      expect(stdout).toContain("cursors");
    });

    it("should output JSON envelope with type and command for cursor results", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.cursors.getAll.mockResolvedValue({
        "conn-1": {
          clientId: "user-1",
          connectionId: "conn-1",
          position: { x: 10, y: 20 },
          data: null,
        },
      });

      const { stdout } = await runCommand(
        ["spaces:cursors:get", "test-space", "--json"],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const resultRecord = records.find(
        (r) => r.type === "result" && Array.isArray(r.cursors),
      );
      expect(resultRecord).toBeDefined();
      expect(resultRecord).toHaveProperty("type", "result");
      expect(resultRecord).toHaveProperty("command");
      expect(resultRecord).toHaveProperty("success", true);
      expect(resultRecord!.cursors).toBeInstanceOf(Array);
    });

    it("should leave space and close client on completion", async () => {
      const realtimeMock = getMockAblyRealtime();
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.cursors.getAll.mockResolvedValue({});

      await runCommand(
        ["spaces:cursors:get", "test-space", "--json"],
        import.meta.url,
      );

      // Verify cleanup was performed
      expect(realtimeMock.close).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle getAll rejection gracefully", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.cursors.getAll.mockRejectedValue(
        new Error("Failed to get cursors"),
      );

      const { error } = await runCommand(
        ["spaces:cursors:get", "test-space"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(space.cursors.getAll).toHaveBeenCalled();
    });
  });
});
