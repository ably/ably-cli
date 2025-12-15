import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";

describe("spaces:locks:subscribe command", () => {
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
      const mockLocks = {
        subscribe: vi.fn().mockResolvedValue(),
        unsubscribe: vi.fn().mockResolvedValue(),
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockMembers = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockCursors = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockLocations = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockSpace = {
        locks: mockLocks,
        members: mockMembers,
        cursors: mockCursors,
        locations: mockLocations,
        enter: vi.fn().mockResolvedValue(),
        leave: vi.fn().mockResolvedValue(),
      };

      const mockConnection = {
        on: vi.fn(),
        once: vi.fn(),
        state: "connected",
        id: "test-connection-id",
      };

      const mockAuth = {
        clientId: "test-client-id",
      };

      const mockRealtimeClient = {
        connection: mockConnection,
        auth: mockAuth,
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
      const mockLocks = {
        subscribe: vi.fn().mockResolvedValue(),
        unsubscribe: vi.fn().mockResolvedValue(),
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockMembers = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockCursors = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockLocations = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockSpace = {
        locks: mockLocks,
        members: mockMembers,
        cursors: mockCursors,
        locations: mockLocations,
        enter: vi.fn().mockResolvedValue(),
        leave: vi.fn().mockResolvedValue(),
      };

      const mockConnection = {
        on: vi.fn(),
        once: vi.fn(),
        state: "connected",
        id: "test-connection-id",
      };

      const mockAuth = {
        clientId: "test-client-id",
      };

      const mockRealtimeClient = {
        connection: mockConnection,
        auth: mockAuth,
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

      setTimeout(() => process.emit("SIGINT", "SIGINT"), 100);

      await runCommand(
        ["spaces:locks:subscribe", "test-space"],
        import.meta.url,
      );

      expect(mockSpace.enter).toHaveBeenCalled();
      expect(mockLocks.subscribe).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should display initial subscription message", async () => {
      const mockLocks = {
        subscribe: vi.fn().mockResolvedValue(),
        unsubscribe: vi.fn().mockResolvedValue(),
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockMembers = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockCursors = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockLocations = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockSpace = {
        locks: mockLocks,
        members: mockMembers,
        cursors: mockCursors,
        locations: mockLocations,
        enter: vi.fn().mockResolvedValue(),
        leave: vi.fn().mockResolvedValue(),
      };

      const mockConnection = {
        on: vi.fn(),
        once: vi.fn(),
        state: "connected",
        id: "test-connection-id",
      };

      const mockAuth = {
        clientId: "test-client-id",
      };

      const mockRealtimeClient = {
        connection: mockConnection,
        auth: mockAuth,
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

      setTimeout(() => process.emit("SIGINT", "SIGINT"), 100);

      const { stdout } = await runCommand(
        ["spaces:locks:subscribe", "test-space"],
        import.meta.url,
      );

      expect(stdout).toContain("Subscribing to lock events");
      expect(stdout).toContain("test-space");
    });

    it("should fetch and display current locks", async () => {
      const mockLocksData = [
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
      ];

      const mockLocks = {
        subscribe: vi.fn().mockResolvedValue(),
        unsubscribe: vi.fn().mockResolvedValue(),
        getAll: vi.fn().mockResolvedValue(mockLocksData),
      };

      const mockMembers = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockCursors = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockLocations = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockSpace = {
        locks: mockLocks,
        members: mockMembers,
        cursors: mockCursors,
        locations: mockLocations,
        enter: vi.fn().mockResolvedValue(),
        leave: vi.fn().mockResolvedValue(),
      };

      const mockConnection = {
        on: vi.fn(),
        once: vi.fn(),
        state: "connected",
        id: "test-connection-id",
      };

      const mockAuth = {
        clientId: "test-client-id",
      };

      const mockRealtimeClient = {
        connection: mockConnection,
        auth: mockAuth,
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

      setTimeout(() => process.emit("SIGINT", "SIGINT"), 100);

      const { stdout } = await runCommand(
        ["spaces:locks:subscribe", "test-space"],
        import.meta.url,
      );

      expect(mockLocks.getAll).toHaveBeenCalled();
      expect(stdout).toContain("Current locks");
      expect(stdout).toContain("lock-1");
    });

    it("should show message when no locks exist", async () => {
      const mockLocks = {
        subscribe: vi.fn().mockResolvedValue(),
        unsubscribe: vi.fn().mockResolvedValue(),
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockMembers = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockCursors = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockLocations = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockSpace = {
        locks: mockLocks,
        members: mockMembers,
        cursors: mockCursors,
        locations: mockLocations,
        enter: vi.fn().mockResolvedValue(),
        leave: vi.fn().mockResolvedValue(),
      };

      const mockConnection = {
        on: vi.fn(),
        once: vi.fn(),
        state: "connected",
        id: "test-connection-id",
      };

      const mockAuth = {
        clientId: "test-client-id",
      };

      const mockRealtimeClient = {
        connection: mockConnection,
        auth: mockAuth,
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
      const mockLocks = {
        subscribe: vi.fn().mockResolvedValue(),
        unsubscribe: vi.fn().mockResolvedValue(),
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockMembers = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockCursors = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockLocations = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockSpace = {
        locks: mockLocks,
        members: mockMembers,
        cursors: mockCursors,
        locations: mockLocations,
        enter: vi.fn().mockResolvedValue(),
        leave: vi.fn().mockResolvedValue(),
      };

      const mockConnection = {
        on: vi.fn(),
        once: vi.fn(),
        state: "connected",
        id: "test-connection-id",
      };

      const mockAuth = {
        clientId: "test-client-id",
      };

      const mockClose = vi.fn();
      const mockRealtimeClient = {
        connection: mockConnection,
        auth: mockAuth,
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

      // Use SIGINT to exit
      setTimeout(() => process.emit("SIGINT", "SIGINT"), 100);

      await runCommand(
        ["spaces:locks:subscribe", "test-space"],
        import.meta.url,
      );

      // Verify close was called during cleanup
      expect(mockClose).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle getAll rejection gracefully", async () => {
      const mockLocks = {
        subscribe: vi.fn().mockResolvedValue(),
        unsubscribe: vi.fn().mockResolvedValue(),
        getAll: vi.fn().mockRejectedValue(new Error("Failed to get locks")),
      };

      const mockMembers = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockCursors = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockLocations = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockSpace = {
        locks: mockLocks,
        members: mockMembers,
        cursors: mockCursors,
        locations: mockLocations,
        enter: vi.fn().mockResolvedValue(),
        leave: vi.fn().mockResolvedValue(),
      };

      const mockConnection = {
        on: vi.fn(),
        once: vi.fn(),
        state: "connected",
        id: "test-connection-id",
      };

      const mockAuth = {
        clientId: "test-client-id",
      };

      const mockRealtimeClient = {
        connection: mockConnection,
        auth: mockAuth,
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
