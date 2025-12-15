import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";

describe("spaces:locations:get-all command", () => {
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
        ["spaces:locations:get-all", "test-space", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should require space argument", async () => {
      const { error } = await runCommand(
        ["spaces:locations:get-all"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });

    it("should accept --json flag", async () => {
      const mockLocations = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockMembers = {
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockSpace = {
        locations: mockLocations,
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
        ["spaces:locations:get-all", "test-space", "--json"],
        import.meta.url,
      );

      expect(error?.message || "").not.toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("location retrieval", () => {
    it("should get all locations from a space", async () => {
      const mockLocationsData = [
        {
          member: { clientId: "user-1", connectionId: "conn-1" },
          currentLocation: { x: 100, y: 200 },
          previousLocation: null,
        },
      ];

      const mockLocations = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue(mockLocationsData),
      };

      const mockMembers = {
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockSpace = {
        locations: mockLocations,
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
        ["spaces:locations:get-all", "test-space", "--json"],
        import.meta.url,
      );

      expect(mockSpace.enter).toHaveBeenCalled();
      expect(mockLocations.getAll).toHaveBeenCalled();
      expect(stdout).toContain("test-space");
    });

    it("should handle no locations found", async () => {
      const mockLocations = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockMembers = {
        getAll: vi.fn().mockResolvedValue([]),
      };

      const mockSpace = {
        locations: mockLocations,
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
        ["spaces:locations:get-all", "test-space", "--json"],
        import.meta.url,
      );

      expect(stdout).toContain("locations");
    });
  });
});
