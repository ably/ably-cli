import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";

describe("spaces:cursors:subscribe command", () => {
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
      const mockCursorsChannel = {
        state: "attached",
        on: vi.fn(),
        off: vi.fn(),
      };

      const mockCursors = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
        channel: mockCursorsChannel,
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

      const mockLocations = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockSpace = {
        cursors: mockCursors,
        members: mockMembers,
        locks: mockLocks,
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
      const mockCursorsChannel = {
        state: "attached",
        on: vi.fn(),
        off: vi.fn(),
      };

      const mockCursors = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
        channel: mockCursorsChannel,
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

      const mockLocations = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockSpace = {
        cursors: mockCursors,
        members: mockMembers,
        locks: mockLocks,
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
        ["spaces:cursors:subscribe", "test-space"],
        import.meta.url,
      );

      expect(mockSpace.enter).toHaveBeenCalled();
      expect(mockCursors.subscribe).toHaveBeenCalledWith(
        "update",
        expect.any(Function),
      );
    });

    it("should display initial subscription message", async () => {
      const mockCursorsChannel = {
        state: "attached",
        on: vi.fn(),
        off: vi.fn(),
      };

      const mockCursors = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
        channel: mockCursorsChannel,
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

      const mockLocations = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockSpace = {
        cursors: mockCursors,
        members: mockMembers,
        locks: mockLocks,
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
        ["spaces:cursors:subscribe", "test-space"],
        import.meta.url,
      );

      expect(stdout).toContain("Subscribing");
      expect(stdout).toContain("test-space");
    });
  });

  describe("cleanup behavior", () => {
    it("should close client on completion", async () => {
      const mockCursorsChannel = {
        state: "attached",
        on: vi.fn(),
        off: vi.fn(),
      };

      const mockCursors = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
        channel: mockCursorsChannel,
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

      const mockLocations = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockSpace = {
        cursors: mockCursors,
        members: mockMembers,
        locks: mockLocks,
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
        ["spaces:cursors:subscribe", "test-space"],
        import.meta.url,
      );

      // Verify close was called during cleanup (either by performCleanup or finally block)
      expect(mockClose).toHaveBeenCalled();
    });
  });

  describe("channel attachment", () => {
    it("should wait for cursors channel to attach if not already attached", async () => {
      const attachedCallback = vi.fn();
      const mockCursorsChannel = {
        state: "attaching",
        on: vi.fn((event, callback) => {
          if (event === "attached") {
            attachedCallback.mockImplementation(callback);
            // Simulate channel attaching shortly after
            setTimeout(() => callback(), 50);
          }
        }),
        off: vi.fn(),
      };

      const mockCursors = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
        channel: mockCursorsChannel,
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

      const mockLocations = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      const mockSpace = {
        cursors: mockCursors,
        members: mockMembers,
        locks: mockLocks,
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

      setTimeout(() => process.emit("SIGINT", "SIGINT"), 200);

      await runCommand(
        ["spaces:cursors:subscribe", "test-space"],
        import.meta.url,
      );

      // Verify the command registered for attachment events
      expect(mockCursorsChannel.on).toHaveBeenCalledWith(
        "attached",
        expect.any(Function),
      );
    });
  });
});
