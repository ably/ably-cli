import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblySpaces } from "../../../../helpers/mock-ably-spaces.js";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";

describe("spaces:locations:subscribe command", () => {
  beforeEach(() => {
    // Initialize the mocks
    getMockAblyRealtime();
    getMockAblySpaces();
  });

  describe("command arguments and flags", () => {
    it("should require space argument", async () => {
      const { error } = await runCommand(
        ["spaces:locations:subscribe"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });

    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["spaces:locations:subscribe", "test-space", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should accept --json flag", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locations.getAll.mockResolvedValue({});

      // Use SIGINT to exit the command
      setTimeout(() => process.emit("SIGINT", "SIGINT"), 100);

      const { error } = await runCommand(
        ["spaces:locations:subscribe", "test-space", "--json"],
        import.meta.url,
      );

      // Should not have unknown flag error
      expect(error?.message || "").not.toMatch(/unknown|Nonexistent flag/i);
    });

    it("should accept --pretty-json flag", async () => {
      const { error } = await runCommand(
        ["spaces:locations:subscribe", "test-space", "--pretty-json"],
        import.meta.url,
      );

      // Should not have unknown flag error
      expect(error?.message || "").not.toMatch(/unknown|Nonexistent flag/i);
    });

    it("should accept --duration flag", async () => {
      const { error } = await runCommand(
        ["spaces:locations:subscribe", "test-space", "--duration", "1"],
        import.meta.url,
      );

      // Should not have unknown flag error (command may fail for other reasons without mocks)
      expect(error?.message || "").not.toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("subscription behavior", () => {
    it("should subscribe to location updates in a space", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locations.getAll.mockResolvedValue({});

      setTimeout(() => process.emit("SIGINT", "SIGINT"), 100);

      await runCommand(
        ["spaces:locations:subscribe", "test-space"],
        import.meta.url,
      );

      expect(space.enter).toHaveBeenCalled();
      expect(space.locations.subscribe).toHaveBeenCalledWith(
        "update",
        expect.any(Function),
      );
    });

    it("should display initial subscription message", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locations.getAll.mockResolvedValue({});

      setTimeout(() => process.emit("SIGINT", "SIGINT"), 100);

      const { stdout } = await runCommand(
        ["spaces:locations:subscribe", "test-space"],
        import.meta.url,
      );

      expect(stdout).toContain("Subscribing to location updates");
      expect(stdout).toContain("test-space");
    });

    it("should fetch and display current locations", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locations.getAll.mockResolvedValue({
        "conn-1": { room: "lobby", x: 100 },
        "conn-2": { room: "chat", x: 200 },
      });

      setTimeout(() => process.emit("SIGINT", "SIGINT"), 100);

      const { stdout } = await runCommand(
        ["spaces:locations:subscribe", "test-space"],
        import.meta.url,
      );

      expect(space.locations.getAll).toHaveBeenCalled();
      expect(stdout).toContain("Current locations");
    });
  });

  describe("cleanup behavior", () => {
    it("should close client on completion", async () => {
      const realtimeMock = getMockAblyRealtime();
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locations.getAll.mockResolvedValue({});

      // Use SIGINT to exit
      setTimeout(() => process.emit("SIGINT", "SIGINT"), 100);

      await runCommand(
        ["spaces:locations:subscribe", "test-space"],
        import.meta.url,
      );

      // Verify close was called during cleanup
      expect(realtimeMock.close).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle getAll rejection gracefully", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locations.getAll.mockRejectedValue(
        new Error("Failed to get locations"),
      );

      setTimeout(() => process.emit("SIGINT", "SIGINT"), 100);

      // The command catches getAll errors and continues
      const { stdout } = await runCommand(
        ["spaces:locations:subscribe", "test-space"],
        import.meta.url,
      );

      // Command should still subscribe even if getAll fails
      expect(space.locations.subscribe).toHaveBeenCalled();
      expect(stdout).toBeDefined();
    });
  });
});
