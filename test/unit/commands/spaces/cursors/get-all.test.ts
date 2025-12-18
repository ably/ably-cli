import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblySpaces } from "../../../../helpers/mock-ably-spaces.js";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";

describe("spaces:cursors:get-all command", () => {
  beforeEach(() => {
    // Initialize the mocks
    getMockAblyRealtime();
    getMockAblySpaces();
  });

  describe("command arguments and flags", () => {
    it("should require space argument", async () => {
      const { error } = await runCommand(
        ["spaces:cursors:get-all"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });

    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["spaces:cursors:get-all", "test-space", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should accept --json flag", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.cursors.getAll.mockResolvedValue([]);

      const { error } = await runCommand(
        ["spaces:cursors:get-all", "test-space", "--json"],
        import.meta.url,
      );

      // Should not have unknown flag error
      expect(error?.message || "").not.toMatch(/unknown|Nonexistent flag/i);
    });

    it("should accept --pretty-json flag", async () => {
      const { error } = await runCommand(
        ["spaces:cursors:get-all", "test-space", "--pretty-json"],
        import.meta.url,
      );

      // Should not have unknown flag error
      expect(error?.message || "").not.toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("cursor retrieval", () => {
    it("should get all cursors from a space", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.cursors.getAll.mockResolvedValue([
        {
          clientId: "user-1",
          connectionId: "conn-1",
          position: { x: 100, y: 200 },
          data: { color: "red" },
        },
        {
          clientId: "user-2",
          connectionId: "conn-2",
          position: { x: 300, y: 400 },
          data: { color: "blue" },
        },
      ]);

      const { stdout } = await runCommand(
        ["spaces:cursors:get-all", "test-space", "--json"],
        import.meta.url,
      );

      expect(space.enter).toHaveBeenCalled();
      expect(space.cursors.subscribe).toHaveBeenCalledWith(
        "update",
        expect.any(Function),
      );
      expect(space.cursors.getAll).toHaveBeenCalled();

      // The command outputs multiple JSON lines - check the content contains expected data
      expect(stdout).toContain("test-space");
      expect(stdout).toContain("success");
    });

    it("should handle no cursors found", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.cursors.getAll.mockResolvedValue([]);

      const { stdout } = await runCommand(
        ["spaces:cursors:get-all", "test-space", "--json"],
        import.meta.url,
      );

      // The command outputs multiple JSON lines, last one has cursors array
      expect(stdout).toContain("cursors");
    });
  });

  describe("error handling", () => {
    it("should handle getAll rejection gracefully", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.cursors.getAll.mockRejectedValue(
        new Error("Failed to get cursors"),
      );

      // The command catches getAll errors and continues with live updates only
      // So this should complete without throwing
      const { stdout } = await runCommand(
        ["spaces:cursors:get-all", "test-space", "--json"],
        import.meta.url,
      );

      // Command should still output JSON even if getAll fails
      expect(stdout).toBeDefined();
      expect(space.cursors.getAll).toHaveBeenCalled();
    });
  });

  describe("cleanup behavior", () => {
    it("should leave space and close client on completion", async () => {
      const realtimeMock = getMockAblyRealtime();
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.cursors.getAll.mockResolvedValue([]);

      await runCommand(
        ["spaces:cursors:get-all", "test-space", "--json"],
        import.meta.url,
      );

      // Verify cleanup was performed
      expect(space.leave).toHaveBeenCalled();
      expect(realtimeMock.close).toHaveBeenCalled();
    });
  });
});
