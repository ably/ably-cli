import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblySpaces } from "../../../../helpers/mock-ably-spaces.js";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";

describe("spaces:members:subscribe command", () => {
  beforeEach(() => {
    getMockAblyRealtime();
    getMockAblySpaces();
  });

  describe("command arguments and flags", () => {
    it("should require space argument", async () => {
      const { error } = await runCommand(
        ["spaces:members:subscribe"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });

    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["spaces:members:subscribe", "test-space", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("initial member display", () => {
    it("should display current members from getAll()", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.members.getAll.mockResolvedValue([
        {
          clientId: "user-1",
          connectionId: "conn-1",
          isConnected: true,
          profileData: {},
        },
        {
          clientId: "user-2",
          connectionId: "conn-2",
          isConnected: true,
          profileData: {},
        },
      ]);

      const { stdout } = await runCommand(
        ["spaces:members:subscribe", "test-space"],
        import.meta.url,
      );

      expect(space.members.getAll).toHaveBeenCalled();
      expect(stdout).toContain("Current members");
      expect(stdout).toContain("user-1");
      expect(stdout).toContain("user-2");
    });

    it("should show profile data for members", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.members.getAll.mockResolvedValue([
        {
          clientId: "user-1",
          connectionId: "conn-1",
          isConnected: true,
          profileData: { name: "Alice", role: "admin" },
        },
      ]);

      const { stdout } = await runCommand(
        ["spaces:members:subscribe", "test-space"],
        import.meta.url,
      );

      expect(stdout).toContain("Alice");
      expect(stdout).toContain("admin");
    });

    it("should show message when no members are present", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.members.getAll.mockResolvedValue([]);

      const { stdout } = await runCommand(
        ["spaces:members:subscribe", "test-space"],
        import.meta.url,
      );

      expect(stdout).toContain("No members are currently present");
    });
  });

  describe("subscription behavior", () => {
    it("should subscribe to member update events", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.members.getAll.mockResolvedValue([]);

      await runCommand(
        ["spaces:members:subscribe", "test-space"],
        import.meta.url,
      );

      expect(space.enter).toHaveBeenCalled();
      expect(space.members.subscribe).toHaveBeenCalledWith(
        "update",
        expect.any(Function),
      );
    });
  });

  describe("JSON output", () => {
    it("should output JSON for initial members", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.members.getAll.mockResolvedValue([
        {
          clientId: "user-1",
          connectionId: "conn-1",
          isConnected: true,
          profileData: { name: "Alice" },
        },
      ]);

      const { stdout } = await runCommand(
        ["spaces:members:subscribe", "test-space", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result.success).toBe(true);
      expect(result.members).toHaveLength(1);
      expect(result.members[0].clientId).toBe("user-1");
    });
  });
});
