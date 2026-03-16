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

describe("spaces:locations:get-all command", () => {
  beforeEach(() => {
    // Initialize the mocks
    getMockAblyRealtime();
    getMockAblySpaces();
  });

  standardHelpTests("spaces:locations:get-all", import.meta.url);
  standardArgValidationTests("spaces:locations:get-all", import.meta.url, {
    requiredArgs: ["test-space"],
  });
  standardFlagTests("spaces:locations:get-all", import.meta.url, ["--json"]);

  describe("functionality", () => {
    it("should get all locations from a space", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locations.getAll.mockResolvedValue({
        "conn-1": { x: 100, y: 200 },
      });

      const { stdout } = await runCommand(
        ["spaces:locations:get-all", "test-space", "--json"],
        import.meta.url,
      );

      expect(space.enter).toHaveBeenCalled();
      expect(space.locations.getAll).toHaveBeenCalled();
      expect(stdout).toContain("locations");
    });

    it("should output JSON envelope with type and command for location results", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locations.getAll.mockResolvedValue({
        "conn-1": { x: 100, y: 200 },
      });

      const { stdout } = await runCommand(
        ["spaces:locations:get-all", "test-space", "--json"],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const resultRecord = records.find(
        (r) => r.type === "result" && Array.isArray(r.locations),
      );
      expect(resultRecord).toBeDefined();
      expect(resultRecord).toHaveProperty("type", "result");
      expect(resultRecord).toHaveProperty("command");
      expect(resultRecord).toHaveProperty("success", true);
      expect(resultRecord!.locations).toBeInstanceOf(Array);
      expect(resultRecord!.locations.length).toBe(1);
      expect(resultRecord!.locations[0]).toHaveProperty(
        "connectionId",
        "conn-1",
      );
      expect(resultRecord!.locations[0]).toHaveProperty("location");
    });

    it("should handle no locations found", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locations.getAll.mockResolvedValue({});

      const { stdout } = await runCommand(
        ["spaces:locations:get-all", "test-space", "--json"],
        import.meta.url,
      );

      expect(stdout).toContain("locations");
    });
  });

  describe("error handling", () => {
    it("should handle errors gracefully", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locations.getAll.mockRejectedValue(
        new Error("Failed to get locations"),
      );

      const { error } = await runCommand(
        ["spaces:locations:get-all", "test-space"],
        import.meta.url,
      );
      expect(error).toBeDefined();
    });
  });
});
