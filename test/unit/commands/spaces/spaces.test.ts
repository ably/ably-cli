import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";

// Define the type for global test mocks
declare global {
  var __TEST_MOCKS__: {
    ablyRealtimeMock?: unknown;
    ablySpacesMock?: unknown;
  };
}

describe("spaces commands", () => {
  let mockMembersEnter: ReturnType<typeof vi.fn>;
  let mockMembersSubscribe: ReturnType<typeof vi.fn>;
  let mockMembersUnsubscribe: ReturnType<typeof vi.fn>;
  let mockSpaceLeave: ReturnType<typeof vi.fn>;
  let mockLocationsSet: ReturnType<typeof vi.fn>;
  let mockLocationsGetAll: ReturnType<typeof vi.fn>;
  let mockLocksAcquire: ReturnType<typeof vi.fn>;
  let mockLocksGetAll: ReturnType<typeof vi.fn>;
  let mockCursorsSet: ReturnType<typeof vi.fn>;
  let mockCursorsGetAll: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockMembersEnter = vi.fn().mockResolvedValue(null);
    mockMembersSubscribe = vi.fn().mockResolvedValue(null);
    mockMembersUnsubscribe = vi.fn().mockResolvedValue(null);
    mockSpaceLeave = vi.fn().mockResolvedValue(null);
    mockLocationsSet = vi.fn().mockResolvedValue(null);
    mockLocationsGetAll = vi.fn().mockResolvedValue([]);
    mockLocksAcquire = vi.fn().mockResolvedValue({ id: "lock-1" });
    mockLocksGetAll = vi.fn().mockResolvedValue([]);
    mockCursorsSet = vi.fn().mockResolvedValue(null);
    mockCursorsGetAll = vi.fn().mockResolvedValue([]);

    const mockSpace = {
      name: "test-space",
      enter: mockMembersEnter,
      leave: mockSpaceLeave,
      members: {
        subscribe: mockMembersSubscribe,
        unsubscribe: mockMembersUnsubscribe,
        getAll: vi.fn().mockResolvedValue([]),
        getSelf: vi.fn().mockResolvedValue({
          clientId: "test-client-id",
          connectionId: "conn-123",
          isConnected: true,
          profileData: {},
        }),
      },
      locations: {
        set: mockLocationsSet,
        getAll: mockLocationsGetAll,
        getSelf: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      },
      locks: {
        acquire: mockLocksAcquire,
        getAll: mockLocksGetAll,
        get: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      },
      cursors: {
        set: mockCursorsSet,
        getAll: mockCursorsGetAll,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      },
    };

    globalThis.__TEST_MOCKS__ = {
      ablyRealtimeMock: {
        channels: {
          get: vi.fn().mockReturnValue({
            name: "test-channel",
            state: "attached",
            on: vi.fn(),
            off: vi.fn(),
            once: vi.fn(),
          }),
        },
        connection: {
          id: "conn-123",
          state: "connected",
          on: vi.fn(),
          once: vi.fn((event: string, callback: () => void) => {
            if (event === "connected") {
              setTimeout(() => callback(), 5);
            }
          }),
        },
        close: vi.fn(),
        auth: {
          clientId: "test-client-id",
        },
      },
      ablySpacesMock: {
        get: vi.fn().mockResolvedValue(mockSpace),
      },
    };
  });

  afterEach(() => {
    delete globalThis.__TEST_MOCKS__;
  });

  describe("spaces topic", () => {
    it("should list available spaces subcommands when run without arguments", async () => {
      const { stdout } = await runCommand(["spaces"], import.meta.url);

      expect(stdout).toContain("Spaces commands");
      expect(stdout).toContain("members");
      expect(stdout).toContain("locations");
      expect(stdout).toContain("locks");
      expect(stdout).toContain("cursors");
    });

    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["spaces", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Interact with Ably Spaces");
      expect(stdout).toContain("USAGE");
    });
  });

  describe("spaces members enter", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["spaces:members:enter", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Enter a space");
      expect(stdout).toContain("USAGE");
      expect(stdout).toContain("SPACE");
    });

    it("should enter a space successfully", async () => {
      const { stdout } = await runCommand(
        ["spaces:members:enter", "test-space", "--api-key", "app.key:secret"],
        import.meta.url,
      );

      expect(stdout).toContain("test-space");
      expect(mockMembersEnter).toHaveBeenCalled();
    });

    it("should enter a space with profile data", async () => {
      const { stdout } = await runCommand(
        [
          "spaces:members:enter",
          "test-space",
          "--api-key",
          "app.key:secret",
          "--profile",
          '{"name":"TestUser","status":"online"}',
        ],
        import.meta.url,
      );

      expect(stdout).toContain("test-space");
      expect(mockMembersEnter).toHaveBeenCalledWith({
        name: "TestUser",
        status: "online",
      });
    });
  });

  describe("spaces members subscribe", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["spaces:members:subscribe", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Subscribe to member");
      expect(stdout).toContain("USAGE");
      expect(stdout).toContain("SPACE");
    });

    it("should subscribe and display member events with action and client info", async () => {
      // Capture the member callback to simulate events
      let memberCallback: ((member: unknown) => void) | null = null;
      mockMembersSubscribe.mockImplementation(
        (_event: string, callback: (member: unknown) => void) => {
          memberCallback = callback;
          return Promise.resolve();
        },
      );

      const commandPromise = runCommand(
        [
          "spaces:members:subscribe",
          "test-space",
          "--api-key",
          "app.key:secret",
        ],
        import.meta.url,
      );

      // Wait for subscription to be set up
      await vi.waitFor(() => {
        expect(memberCallback).not.toBeNull();
      });

      // Simulate a member entering - use a different connectionId than the mock's
      memberCallback!({
        clientId: "new-user",
        connectionId: "other-conn-456",
        isConnected: true,
        profileData: { name: "New User" },
        lastEvent: { name: "enter" },
      });

      const { stdout } = await commandPromise;

      // Should display member event with client info and action
      expect(stdout).toContain("new-user");
      expect(stdout).toContain("enter");
    });
  });

  describe("spaces locations set", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["spaces:locations:set", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Set your location");
      expect(stdout).toContain("USAGE");
      expect(stdout).toContain("SPACE");
    });

    it("should set location with --location flag", async () => {
      const { stdout } = await runCommand(
        [
          "spaces:locations:set",
          "test-space",
          "--api-key",
          "app.key:secret",
          "--location",
          '{"x":100,"y":200}',
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Successfully set location");
      expect(mockLocationsSet).toHaveBeenCalledWith({ x: 100, y: 200 });
    });
  });

  describe("spaces locks acquire", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["spaces:locks:acquire", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Acquire a lock");
      expect(stdout).toContain("USAGE");
      expect(stdout).toContain("SPACE");
      expect(stdout).toContain("LOCKID");
    });

    it("should acquire lock with --data flag", async () => {
      const { stdout } = await runCommand(
        [
          "spaces:locks:acquire",
          "test-space",
          "my-lock",
          "--api-key",
          "app.key:secret",
          "--data",
          '{"reason":"editing"}',
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Successfully acquired lock");
      expect(mockLocksAcquire).toHaveBeenCalledWith("my-lock", {
        reason: "editing",
      });
    });
  });

  describe("spaces cursors set", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["spaces:cursors:set", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("cursor");
      expect(stdout).toContain("USAGE");
      expect(stdout).toContain("SPACE");
    });

    it("should set cursor with x and y flags", async () => {
      const { stdout } = await runCommand(
        [
          "spaces:cursors:set",
          "test-space",
          "--api-key",
          "app.key:secret",
          "--x",
          "50",
          "--y",
          "75",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Set cursor");
      expect(mockCursorsSet).toHaveBeenCalledWith({
        position: { x: 50, y: 75 },
      });
    });
  });
});
