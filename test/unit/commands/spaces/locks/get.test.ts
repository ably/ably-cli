import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";

describe("spaces:locks:get command", () => {
  beforeEach(() => {
    if (globalThis.__TEST_MOCKS__) {
      delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
      delete globalThis.__TEST_MOCKS__.ablySpacesMock;
    }
  });

  afterEach(() => {
    if (globalThis.__TEST_MOCKS__) {
      delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
      delete globalThis.__TEST_MOCKS__.ablySpacesMock;
    }
  });

  describe("command arguments and flags", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["spaces:locks:get", "test-space", "my-lock", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should require space argument", async () => {
      const { error } = await runCommand(["spaces:locks:get"], import.meta.url);

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });

    it("should require lockId argument", async () => {
      const { error } = await runCommand(
        ["spaces:locks:get", "test-space"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });

    it("should accept --json flag", async () => {
      const mockLocks = {
        get: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockMembers = {
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockSpace = {
        locks: mockLocks,
        members: mockMembers,
        enter: vi.fn().mockResolvedValue(),
        leave: vi.fn().mockResolvedValue(),
      };

      const mockConnection = {
        on: vi.fn(),
        once: vi.fn(),
        state: "connected",
        id: "test-connection-id",
      };

      const mockRealtimeClient = {
        connection: mockConnection,
        close: vi.fn(),
      };

      const mockSpacesClient = {
        get: vi.fn().mockReturnValue(mockSpace),
      };

      globalThis.__TEST_MOCKS__ = {
        ...globalThis.__TEST_MOCKS__,
        ablyRealtimeMock: mockRealtimeClient,
        ablySpacesMock: mockSpacesClient,
      };

      const { error } = await runCommand(
        ["spaces:locks:get", "test-space", "my-lock", "--json"],
        import.meta.url,
      );

      expect(error?.message || "").not.toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("lock retrieval", () => {
    it("should get a specific lock by ID", async () => {
      const mockLockData = {
        id: "my-lock",
        member: { clientId: "user-1", connectionId: "conn-1" },
        status: "locked",
      };

      const mockLocks = {
        get: vi.fn().mockResolvedValue(mockLockData),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockMembers = {
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockSpace = {
        locks: mockLocks,
        members: mockMembers,
        enter: vi.fn().mockResolvedValue(),
        leave: vi.fn().mockResolvedValue(),
      };

      const mockConnection = {
        on: vi.fn(),
        once: vi.fn(),
        state: "connected",
        id: "test-connection-id",
      };

      const mockRealtimeClient = {
        connection: mockConnection,
        close: vi.fn(),
      };

      const mockSpacesClient = {
        get: vi.fn().mockReturnValue(mockSpace),
      };

      globalThis.__TEST_MOCKS__ = {
        ...globalThis.__TEST_MOCKS__,
        ablyRealtimeMock: mockRealtimeClient,
        ablySpacesMock: mockSpacesClient,
      };

      const { stdout } = await runCommand(
        ["spaces:locks:get", "test-space", "my-lock", "--json"],
        import.meta.url,
      );

      expect(mockSpace.enter).toHaveBeenCalled();
      expect(mockLocks.get).toHaveBeenCalledWith("my-lock");
      expect(stdout).toContain("my-lock");
    });

    it("should handle lock not found", async () => {
      const mockLocks = {
        get: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockMembers = {
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockSpace = {
        locks: mockLocks,
        members: mockMembers,
        enter: vi.fn().mockResolvedValue(),
        leave: vi.fn().mockResolvedValue(),
      };

      const mockConnection = {
        on: vi.fn(),
        once: vi.fn(),
        state: "connected",
        id: "test-connection-id",
      };

      const mockRealtimeClient = {
        connection: mockConnection,
        close: vi.fn(),
      };

      const mockSpacesClient = {
        get: vi.fn().mockReturnValue(mockSpace),
      };

      globalThis.__TEST_MOCKS__ = {
        ...globalThis.__TEST_MOCKS__,
        ablyRealtimeMock: mockRealtimeClient,
        ablySpacesMock: mockSpacesClient,
      };

      const { stdout } = await runCommand(
        ["spaces:locks:get", "test-space", "nonexistent-lock", "--json"],
        import.meta.url,
      );

      expect(mockLocks.get).toHaveBeenCalledWith("nonexistent-lock");
      expect(stdout).toBeDefined();
    });
  });
});
