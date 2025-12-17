import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblySpaces } from "../../../../helpers/mock-ably-spaces.js";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";

describe("spaces:cursors:subscribe command", () => {
  beforeEach(() => {
    // Initialize the mocks
    getMockAblyRealtime();
    getMockAblySpaces();
  });

  describe("command arguments and flags", () => {
    it("should require space argument", async () => {
      const { error } = await runCommand(
        ["spaces:cursors:subscribe"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });

    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["spaces:cursors:subscribe", "test-space", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should accept --json flag", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.cursors.getAll.mockResolvedValue([]);

      // Emit SIGINT to exit the command

      const { error } = await runCommand(
        ["spaces:cursors:subscribe", "test-space", "--json"],
        import.meta.url,
      );

      // Should not have unknown flag error
      expect(error?.message || "").not.toMatch(/unknown|Nonexistent flag/i);
    });

    it("should accept --pretty-json flag", async () => {
      const { error } = await runCommand(
        ["spaces:cursors:subscribe", "test-space", "--pretty-json"],
        import.meta.url,
      );

      // Should not have unknown flag error
      expect(error?.message || "").not.toMatch(/unknown|Nonexistent flag/i);
    });

    it("should accept --duration flag", async () => {
      const { error } = await runCommand(
        ["spaces:cursors:subscribe", "test-space", "--duration", "1"],
        import.meta.url,
      );

      // Should not have unknown flag error (command may fail for other reasons without mocks)
      expect(error?.message || "").not.toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("subscription behavior", () => {
    it("should subscribe to cursor updates in a space", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.cursors.getAll.mockResolvedValue([]);

      await runCommand(
        ["spaces:cursors:subscribe", "test-space"],
        import.meta.url,
      );

      expect(space.enter).toHaveBeenCalled();
      expect(space.cursors.subscribe).toHaveBeenCalledWith(
        "update",
        expect.any(Function),
      );
    });

    it("should display initial subscription message", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.cursors.getAll.mockResolvedValue([]);

      const { stdout } = await runCommand(
        ["spaces:cursors:subscribe", "test-space"],
        import.meta.url,
      );

      expect(stdout).toContain("Subscribing");
      expect(stdout).toContain("test-space");
    });
  });

  describe("cleanup behavior", () => {
    it("should close client on completion", async () => {
      const realtimeMock = getMockAblyRealtime();
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.cursors.getAll.mockResolvedValue([]);

      // Use SIGINT to exit

      await runCommand(
        ["spaces:cursors:subscribe", "test-space"],
        import.meta.url,
      );

      // Verify close was called during cleanup (either by performCleanup or finally block)
      expect(realtimeMock.close).toHaveBeenCalled();
    });
  });

  describe("channel attachment", () => {
    it("should wait for cursors channel to attach if not already attached", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.cursors.getAll.mockResolvedValue([]);

      // Mock channel as attaching
      space.cursors.channel.state = "attaching";
      space.cursors.channel.on.mockImplementation(
        (event: string, callback: () => void) => {
          if (event === "attached") {
            // Simulate channel attaching shortly after
            setTimeout(() => callback(), 50);
          }
        },
      );

      await runCommand(
        ["spaces:cursors:subscribe", "test-space"],
        import.meta.url,
      );

      // Verify the command registered for attachment events
      expect(space.cursors.channel.on).toHaveBeenCalledWith(
        "attached",
        expect.any(Function),
      );
    });
  });
});
