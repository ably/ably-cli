import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblySpaces } from "../../../../helpers/mock-ably-spaces.js";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";

describe("spaces:locks:get-all command", () => {
  beforeEach(() => {
    // Initialize the mocks
    getMockAblyRealtime();
    getMockAblySpaces();
  });

  describe("command arguments and flags", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["spaces:locks:get-all", "test-space", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should require space argument", async () => {
      const { error } = await runCommand(
        ["spaces:locks:get-all"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });

    it("should accept --json flag", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.getAll.mockResolvedValue([]);

      const { error } = await runCommand(
        ["spaces:locks:get-all", "test-space", "--json"],
        import.meta.url,
      );

      expect(error?.message || "").not.toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("lock retrieval", () => {
    it("should get all locks from a space", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.getAll.mockResolvedValue([
        {
          id: "lock-1",
          member: { clientId: "user-1", connectionId: "conn-1" },
          status: "locked",
        },
      ]);

      const { stdout } = await runCommand(
        ["spaces:locks:get-all", "test-space", "--json"],
        import.meta.url,
      );

      expect(space.enter).toHaveBeenCalled();
      expect(space.locks.getAll).toHaveBeenCalled();
      expect(stdout).toContain("test-space");
    });

    it("should handle no locks found", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.getAll.mockResolvedValue([]);

      const { stdout } = await runCommand(
        ["spaces:locks:get-all", "test-space", "--json"],
        import.meta.url,
      );

      expect(stdout).toContain("locks");
    });
  });
});
