import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblySpaces } from "../../../../helpers/mock-ably-spaces.js";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";

describe("spaces:locations:get-all command", () => {
  beforeEach(() => {
    // Initialize the mocks
    getMockAblyRealtime();
    getMockAblySpaces();
  });

  describe("command arguments and flags", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["spaces:locations:get-all", "test-space", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should require space argument", async () => {
      const { error } = await runCommand(
        ["spaces:locations:get-all"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });

    it("should accept --json flag", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locations.getAll.mockResolvedValue([]);

      const { error } = await runCommand(
        ["spaces:locations:get-all", "test-space", "--json"],
        import.meta.url,
      );

      expect(error?.message || "").not.toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("location retrieval", () => {
    it("should get all locations from a space", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locations.getAll.mockResolvedValue([
        {
          member: { clientId: "user-1", connectionId: "conn-1" },
          currentLocation: { x: 100, y: 200 },
          previousLocation: null,
        },
      ]);

      const { stdout } = await runCommand(
        ["spaces:locations:get-all", "test-space", "--json"],
        import.meta.url,
      );

      expect(space.enter).toHaveBeenCalled();
      expect(space.locations.getAll).toHaveBeenCalled();
      expect(stdout).toContain("test-space");
    });

    it("should handle no locations found", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locations.getAll.mockResolvedValue([]);

      const { stdout } = await runCommand(
        ["spaces:locations:get-all", "test-space", "--json"],
        import.meta.url,
      );

      expect(stdout).toContain("locations");
    });
  });
});
