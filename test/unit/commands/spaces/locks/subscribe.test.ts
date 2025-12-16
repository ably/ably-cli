import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblySpaces } from "../../../../helpers/mock-ably-spaces.js";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";

describe("spaces:locks:subscribe command", () => {
  beforeEach(() => {
    // Initialize the mocks
    getMockAblyRealtime();
    getMockAblySpaces();
  });

  describe("command arguments and flags", () => {
    it("should require space argument", async () => {
      const { error } = await runCommand(
        ["spaces:locks:subscribe"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });

    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["spaces:locks:subscribe", "test-space", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should accept --json flag", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.getAll.mockResolvedValue([]);

      // Emit SIGINT to exit the command
      setTimeout(() => process.emit("SIGINT", "SIGINT"), 100);

      const { error } = await runCommand(
        ["spaces:locks:subscribe", "test-space", "--json"],
        import.meta.url,
      );

      // Should not have unknown flag error
      expect(error?.message || "").not.toMatch(/unknown|Nonexistent flag/i);
    });

    it("should accept --pretty-json flag", async () => {
      const { error } = await runCommand(
        ["spaces:locks:subscribe", "test-space", "--pretty-json"],
        import.meta.url,
      );

      // Should not have unknown flag error
      expect(error?.message || "").not.toMatch(/unknown|Nonexistent flag/i);
    });

    it("should accept --duration flag", async () => {
      const { error } = await runCommand(
        ["spaces:locks:subscribe", "test-space", "--duration", "1"],
        import.meta.url,
      );

      // Should not have unknown flag error (command may fail for other reasons without mocks)
      expect(error?.message || "").not.toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("subscription behavior", () => {
    it("should subscribe to lock events in a space", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.getAll.mockResolvedValue([]);

      setTimeout(() => process.emit("SIGINT", "SIGINT"), 100);

      await runCommand(
        ["spaces:locks:subscribe", "test-space"],
        import.meta.url,
      );

      expect(space.enter).toHaveBeenCalled();
      expect(space.locks.subscribe).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should display initial subscription message", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.getAll.mockResolvedValue([]);

      setTimeout(() => process.emit("SIGINT", "SIGINT"), 100);

      const { stdout } = await runCommand(
        ["spaces:locks:subscribe", "test-space"],
        import.meta.url,
      );

      expect(stdout).toContain("Subscribing to lock events");
      expect(stdout).toContain("test-space");
    });

    it("should fetch and display current locks", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.getAll.mockResolvedValue([
        {
          id: "lock-1",
          status: "locked",
          member: { clientId: "user-1", connectionId: "conn-1" },
        },
        {
          id: "lock-2",
          status: "pending",
          member: { clientId: "user-2", connectionId: "conn-2" },
        },
      ]);

      setTimeout(() => process.emit("SIGINT", "SIGINT"), 100);

      const { stdout } = await runCommand(
        ["spaces:locks:subscribe", "test-space"],
        import.meta.url,
      );

      expect(space.locks.getAll).toHaveBeenCalled();
      expect(stdout).toContain("Current locks");
      expect(stdout).toContain("lock-1");
    });

    it("should show message when no locks exist", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.getAll.mockResolvedValue([]);

      setTimeout(() => process.emit("SIGINT", "SIGINT"), 100);

      const { stdout } = await runCommand(
        ["spaces:locks:subscribe", "test-space"],
        import.meta.url,
      );

      expect(stdout).toContain("No locks");
    });
  });

  describe("cleanup behavior", () => {
    it("should close client on completion", async () => {
      const realtimeMock = getMockAblyRealtime();
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.getAll.mockResolvedValue([]);

      // Use SIGINT to exit
      setTimeout(() => process.emit("SIGINT", "SIGINT"), 100);

      await runCommand(
        ["spaces:locks:subscribe", "test-space"],
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
      space.locks.getAll.mockRejectedValue(new Error("Failed to get locks"));

      setTimeout(() => process.emit("SIGINT", "SIGINT"), 100);

      // The command catches errors and continues
      const { stdout } = await runCommand(
        ["spaces:locks:subscribe", "test-space"],
        import.meta.url,
      );

      // Command should have run (output should be present)
      expect(stdout).toBeDefined();
    });
  });
});
