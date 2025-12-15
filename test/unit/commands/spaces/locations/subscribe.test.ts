import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";

describe("spaces:locations:subscribe command", () => {
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
      const mockLocations = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue({}),
      };

      const mockMembers = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockLocks = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockCursors = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockSpace = {
        locations: mockLocations,
        members: mockMembers,
        locks: mockLocks,
        cursors: mockCursors,
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
      const mockLocations = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue({}),
      };

      const mockMembers = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockLocks = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockCursors = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockSpace = {
        locations: mockLocations,
        members: mockMembers,
        locks: mockLocks,
        cursors: mockCursors,
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
        ["spaces:locations:subscribe", "test-space"],
        import.meta.url,
      );

      expect(mockSpace.enter).toHaveBeenCalled();
      expect(mockLocations.subscribe).toHaveBeenCalledWith(
        "update",
        expect.any(Function),
      );
    });

    it("should display initial subscription message", async () => {
      const mockLocations = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue({}),
      };

      const mockMembers = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockLocks = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockCursors = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockSpace = {
        locations: mockLocations,
        members: mockMembers,
        locks: mockLocks,
        cursors: mockCursors,
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
        ["spaces:locations:subscribe", "test-space"],
        import.meta.url,
      );

      expect(stdout).toContain("Subscribing to location updates");
      expect(stdout).toContain("test-space");
    });

    it("should fetch and display current locations", async () => {
      const mockLocationsData = {
        "conn-1": { room: "lobby", x: 100 },
        "conn-2": { room: "chat", x: 200 },
      };

      const mockLocations = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue(mockLocationsData),
      };

      const mockMembers = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockLocks = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockCursors = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockSpace = {
        locations: mockLocations,
        members: mockMembers,
        locks: mockLocks,
        cursors: mockCursors,
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
        ["spaces:locations:subscribe", "test-space"],
        import.meta.url,
      );

      expect(mockLocations.getAll).toHaveBeenCalled();
      expect(stdout).toContain("Current locations");
    });
  });

  describe("cleanup behavior", () => {
    it("should close client on completion", async () => {
      const mockLocations = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue({}),
      };

      const mockMembers = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockLocks = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockCursors = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockSpace = {
        locations: mockLocations,
        members: mockMembers,
        locks: mockLocks,
        cursors: mockCursors,
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
        ["spaces:locations:subscribe", "test-space"],
        import.meta.url,
      );

      // Verify close was called during cleanup
      expect(mockClose).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle getAll rejection gracefully", async () => {
      const mockLocations = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockRejectedValue(new Error("Failed to get locations")),
      };

      const mockMembers = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockLocks = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockCursors = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockSpace = {
        locations: mockLocations,
        members: mockMembers,
        locks: mockLocks,
        cursors: mockCursors,
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

      // The command catches getAll errors and continues
      const { stdout } = await runCommand(
        ["spaces:locations:subscribe", "test-space"],
        import.meta.url,
      );

      // Command should still subscribe even if getAll fails
      expect(mockLocations.subscribe).toHaveBeenCalled();
      expect(stdout).toBeDefined();
    });
  });
});
