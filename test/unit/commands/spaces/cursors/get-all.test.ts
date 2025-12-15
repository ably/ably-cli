import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";

describe("spaces:cursors:get-all command", () => {
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
      // Set up mocks for successful run
      const mockCursors = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockMembers = {
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockSpace = {
        cursors: mockCursors,
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
      const mockCursorsData = [
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
      ];

      const mockCursors = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue(mockCursorsData),
      };

      const mockMembers = {
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockSpace = {
        cursors: mockCursors,
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
        ["spaces:cursors:get-all", "test-space", "--json"],
        import.meta.url,
      );

      expect(mockSpace.enter).toHaveBeenCalled();
      expect(mockCursors.subscribe).toHaveBeenCalledWith(
        "update",
        expect.any(Function),
      );
      expect(mockCursors.getAll).toHaveBeenCalled();

      // The command outputs multiple JSON lines - check the content contains expected data
      expect(stdout).toContain("test-space");
      expect(stdout).toContain("success");
    });

    it("should handle no cursors found", async () => {
      const mockCursors = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockMembers = {
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockSpace = {
        cursors: mockCursors,
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
        ["spaces:cursors:get-all", "test-space", "--json"],
        import.meta.url,
      );

      // The command outputs multiple JSON lines, last one has cursors array
      expect(stdout).toContain("cursors");
    });
  });

  describe("error handling", () => {
    it("should handle getAll rejection gracefully", async () => {
      const mockCursors = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockRejectedValue(new Error("Failed to get cursors")),
      };

      const mockMembers = {
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockSpace = {
        cursors: mockCursors,
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

      // The command catches getAll errors and continues with live updates only
      // So this should complete without throwing
      const { stdout } = await runCommand(
        ["spaces:cursors:get-all", "test-space", "--json"],
        import.meta.url,
      );

      // Command should still output JSON even if getAll fails
      expect(stdout).toBeDefined();
      expect(mockCursors.getAll).toHaveBeenCalled();
    });
  });

  describe("cleanup behavior", () => {
    it("should leave space and close client on completion", async () => {
      const mockCursors = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockMembers = {
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockSpace = {
        cursors: mockCursors,
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

      const mockClose = vi.fn();
      const mockRealtimeClient = {
        connection: mockConnection,
        close: mockClose,
      };

      const mockSpacesClient = {
        get: vi.fn().mockReturnValue(mockSpace),
      };

      globalThis.__TEST_MOCKS__ = {
        ...globalThis.__TEST_MOCKS__,
        ablyRealtimeMock: mockRealtimeClient,
        ablySpacesMock: mockSpacesClient,
      };

      await runCommand(
        ["spaces:cursors:get-all", "test-space", "--json"],
        import.meta.url,
      );

      // Verify cleanup was performed
      expect(mockSpace.leave).toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled();
    });
  });
});
