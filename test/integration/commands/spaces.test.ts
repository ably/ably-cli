import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { expect as chaiExpect } from "chai";
import { runCommand } from "@oclif/test";
import { registerMock } from "../test-utils.js";

// Mock spaces data
const mockMembers = [
  {
    clientId: "alice",
    connectionId: "conn_1",
    profileData: { name: "Alice", role: "designer" },
    isConnected: true,
    lastEvent: { name: "enter" },
  },
  {
    clientId: "bob",
    connectionId: "conn_2",
    profileData: { name: "Bob", role: "developer" },
    isConnected: true,
    lastEvent: { name: "enter" },
  },
];

const mockLocations = [
  {
    clientId: "alice",
    location: { x: 100, y: 200, page: "dashboard" },
    timestamp: Date.now() - 5000,
  },
  {
    clientId: "bob",
    location: { x: 300, y: 150, page: "editor" },
    timestamp: Date.now() - 3000,
  },
];

const mockCursors = [
  {
    clientId: "alice",
    position: { x: 150, y: 250 },
    data: { color: "red", size: "medium" },
    timestamp: Date.now() - 2000,
  },
  {
    clientId: "bob",
    position: { x: 400, y: 300 },
    data: { color: "blue", size: "large" },
    timestamp: Date.now() - 1000,
  },
];

const mockLocks = [
  {
    id: "document-1",
    member: { clientId: "alice" },
    timestamp: Date.now() - 10000,
    attributes: { priority: "high" },
  },
  {
    id: "section-2",
    member: { clientId: "bob" },
    timestamp: Date.now() - 5000,
    attributes: { timeout: 30000 },
  },
];

// Create comprehensive mock for Spaces client and space
const createMockSpace = (spaceId: string) => ({
  name: spaceId,

  // Members functionality
  members: {
    enter: async (profileData?: any) => {
      mockMembers.push({
        clientId: "test-client",
        connectionId: "test-conn",
        profileData: profileData || { status: "active" },
        isConnected: true,
        lastEvent: { name: "enter" },
      });
      return;
    },
    leave: async () => {},
    getAll: async () => [...mockMembers],
    subscribe: (eventType: string, callback: (member: any) => void) => {
      setTimeout(() => {
        callback({
          clientId: "new-member",
          connectionId: "new-conn",
          profileData: { name: "Charlie", role: "tester" },
          isConnected: true,
          lastEvent: { name: "enter" },
        });
      }, 100);
      return Promise.resolve();
    },
    unsubscribe: async () => {},
  },

  // Locations functionality
  locations: {
    set: async (location: any) => {
      const existingIndex = mockLocations.findIndex(
        (l) => l.clientId === "test-client",
      );
      const locationData = {
        clientId: "test-client",
        location,
        timestamp: Date.now(),
      };

      if (existingIndex === -1) {
        mockLocations.push(locationData);
      } else {
        mockLocations[existingIndex] = locationData;
      }
      return;
    },
    getAll: async () => [...mockLocations],
    subscribe: (callback: (location: any) => void) => {
      setTimeout(() => {
        callback({
          clientId: "moving-client",
          location: { x: 500, y: 600, page: "settings" },
          timestamp: Date.now(),
        });
      }, 100);
      return Promise.resolve();
    },
    unsubscribe: async () => {},
  },

  // Cursors functionality
  cursors: {
    set: async (position: any, data?: any) => {
      const existingIndex = mockCursors.findIndex(
        (c) => c.clientId === "test-client",
      );
      const cursorData = {
        clientId: "test-client",
        position,
        data: data || {},
        timestamp: Date.now(),
      };

      if (existingIndex === -1) {
        mockCursors.push(cursorData);
      } else {
        mockCursors[existingIndex] = cursorData;
      }
      return;
    },
    getAll: async () => [...mockCursors],
    subscribe: (callback: (cursor: any) => void) => {
      setTimeout(() => {
        callback({
          clientId: "cursor-client",
          position: { x: 200, y: 100 },
          data: { color: "green" },
          timestamp: Date.now(),
        });
      }, 100);
      return Promise.resolve();
    },
    unsubscribe: async () => {},
  },

  // Locks functionality
  locks: {
    acquire: async (lockId: string, attributes?: any) => {
      const lockData = {
        id: lockId,
        member: { clientId: "test-client" },
        timestamp: Date.now(),
        attributes: attributes || {},
      };
      mockLocks.push(lockData);
      return lockData;
    },
    release: async (lockId: string) => {
      const index = mockLocks.findIndex((l) => l.id === lockId);
      if (index !== -1) {
        mockLocks.splice(index, 1);
      }
      return;
    },
    get: async (lockId: string) => {
      return mockLocks.find((l) => l.id === lockId) || null;
    },
    getAll: async () => [...mockLocks],
    subscribe: (callback: (lock: any) => void) => {
      setTimeout(() => {
        callback({
          id: "new-lock",
          member: { clientId: "lock-client" },
          timestamp: Date.now(),
          event: "acquire",
        });
      }, 100);
      return Promise.resolve();
    },
    unsubscribe: async () => {},
  },

  // Space lifecycle
  enter: async (profileData?: any) => {
    return mockMembers[0]; // Return first member as entered member
  },
  leave: async () => {},
});

const mockSpacesClient = {
  get: (spaceId: string) => createMockSpace(spaceId),
  release: async (spaceId: string) => {},
};

const mockRealtimeClient = {
  connection: {
    once: (event: string, callback: () => void) => {
      if (event === "connected") {
        setTimeout(callback, 0);
      }
    },
    on: (callback: (stateChange: any) => void) => {
      setTimeout(() => {
        callback({ current: "connected", reason: null });
      }, 10);
    },
    state: "connected",
    id: "test-connection-id",
  },
  close: () => {
    // Mock close method
  },
  auth: {
    clientId: "foo",
  },
};

let originalEnv: NodeJS.ProcessEnv;

describe("Spaces integration tests", function () {
  beforeEach(function () {
    // Store original env vars
    originalEnv = { ...process.env };

    // Set environment variables for this test file
    process.env.ABLY_CLI_TEST_MODE = "true";
    process.env.ABLY_API_KEY = "test.key:secret";

    // Register the spaces and realtime mocks using the test-utils system
    registerMock("ablySpacesMock", mockSpacesClient);
    registerMock("ablyRealtimeMock", mockRealtimeClient);
  });

  afterEach(function () {
    // Restore original environment variables
    process.env = originalEnv;
  });

  describe("Spaces state synchronization", function () {
    const testSpaceId = "integration-test-space";

    it("enters a space with profile data", async function () {
      const { stdout } = await runCommand(
        [
          "spaces",
          "members",
          "enter",
          testSpaceId,
          "--profile",
          '{"name":"Integration Tester","department":"QA"}',
        ],
        import.meta.url,
      );
      expect(stdout).toContain("Successfully entered space");
    });

    it("sets location in a space", async function () {
      const { stdout } = await runCommand(
        [
          "spaces",
          "locations",
          "set",
          testSpaceId,
          "--location",
          '{"x":200,"y":300,"page":"test-page"}',
        ],
        import.meta.url,
      );
      expect(stdout).toContain("Successfully set location");
    });

    it.skip("gets all locations in a space", async function () {
      const { stdout } = await runCommand(
        ["spaces", "locations", "get-all", testSpaceId],
        import.meta.url,
      );

      expect(stdout).toContain("alice");
      expect(stdout).toContain("dashboard");
      expect(stdout).toContain("bob");
      expect(stdout).toContain("editor");
    });

    it("sets cursor position in a space", async function () {
      const { stdout } = await runCommand(
        [
          "spaces",
          "cursors",
          "set",
          testSpaceId,
          "--x",
          "400",
          "--y",
          "500",
          "--data",
          '{"color":"purple"}',
        ],
        import.meta.url,
      );
      expect(stdout).toContain("Set cursor in space");
    });

    it.skip("gets all cursors in a space", async function () {
      const { stdout } = await runCommand(
        ["spaces", "cursors", "get-all", testSpaceId],
        import.meta.url,
      );
      expect(stdout).toContain("alice");
      expect(stdout).toContain("bob");
      expect(stdout).toContain("x:");
      expect(stdout).toContain("y:");
    });

    it("acquires a lock in a space", async function () {
      const { stdout } = await runCommand(
        [
          "spaces",
          "locks",
          "acquire",
          testSpaceId,
          "test-lock",
          "--data",
          '{"priority":"high","timeout":60000}',
        ],
        import.meta.url,
      );
      expect(stdout).toContain("Successfully acquired lock");
      expect(stdout).toContain("test-lock");
    });

    it("gets a specific lock in a space", async function () {
      const { stdout } = await runCommand(
        ["spaces", "locks", "get", testSpaceId, "document-1"],
        import.meta.url,
      );
      expect(stdout).toContain("document-1");
      expect(stdout).toContain("alice");
    });

    it("gets all locks in a space", async function () {
      const { stdout } = await runCommand(
        ["spaces", "locks", "get-all", testSpaceId],
        import.meta.url,
      );
      expect(stdout).toContain("document-1");
      expect(stdout).toContain("section-2");
      expect(stdout).toContain("alice");
      expect(stdout).toContain("bob");
    });
  });

  describe("JSON output format", function () {
    const testSpaceId = "json-test-space";

    it("outputs member enter result in JSON format", async function () {
      const { stdout } = await runCommand(
        [
          "spaces",
          "members",
          "enter",
          testSpaceId,
          "--profile",
          '{"name":"JSON Tester"}',
          "--json",
        ],
        import.meta.url,
      );
      expect(stdout).toContain('"spaceName": "');
      expect(stdout).toContain('"success": true');
    });

    it("outputs locations in JSON format", async function () {
      const { stdout } = await runCommand(
        ["spaces", "locations", "get-all", testSpaceId, "--json"],
        import.meta.url,
      );
      expect(stdout).toContain('"locations": [');
    });

    it("outputs cursors in JSON format", async function () {
      const { stdout } = await runCommand(
        ["spaces", "cursors", "get-all", testSpaceId, "--json"],
        import.meta.url,
      );
      expect(stdout).toContain('"cursors": [');
    });

    it("outputs locks in JSON format", async function () {
      const { stdout } = await runCommand(
        ["spaces", "locks", "get-all", testSpaceId, "--json"],
        import.meta.url,
      );
      expect(stdout).toContain('"locks": [');
    });
  });

  describe("Error handling", function () {
    it("handles invalid space ID gracefully", async function () {
      const { error } = await runCommand(
        ["spaces", "members", "enter", ""],
        import.meta.url,
      );
      expect(error?.message).toContain("Missing 1 required arg");
      expect(error?.message).toContain("space");
    });

    it("handles invalid profile JSON", async function () {
      const { error } = await runCommand(
        [
          "spaces",
          "members",
          "enter",
          "test-space",
          "--profile",
          "invalid-json",
        ],
        import.meta.url,
      );
      expect(error?.message).toContain("Invalid profile JSON");
    });

    it("handles invalid location JSON", async function () {
      const { error } = await runCommand(
        [
          "spaces",
          "locations",
          "set",
          "test-space",
          "--location",
          "invalid-json",
        ],
        import.meta.url,
      );
      expect(error?.message).toContain("Invalid location JSON");
    });

    it("handles invalid cursor position JSON", async function () {
      const { error } = await runCommand(
        ["spaces", "cursors", "set", "test-space", "--data", "invalid-json"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Invalid JSON in --data flag");
    });
  });

  describe("Collaboration scenarios", function () {
    const testSpaceId = "collaboration-test-space";

    it("simulates multiple members entering a space", async function () {
      const { stdout } = await runCommand(
        [
          "spaces",
          "members",
          "enter",
          testSpaceId,
          "--profile",
          '{"name":"Collaborator 1","role":"editor"}',
        ],
        import.meta.url,
      );
      expect(stdout).toContain("Successfully entered space");
    });

    it("simulates location updates during collaboration", async function () {
      const { stdout } = await runCommand(
        [
          "spaces",
          "locations",
          "set",
          testSpaceId,
          "--location",
          '{"x":100,"y":200,"page":"document","section":"intro"}',
        ],
        import.meta.url,
      );
      expect(stdout).toContain("Successfully set location");
    });

    it("simulates cursor movement during collaboration", async function () {
      const { stdout, error } = await runCommand(
        [
          "spaces",
          "cursors",
          "set",
          testSpaceId,
          "--x",
          "250",
          "--y",
          "350",
          "--data",
          '{"action":"editing","element":"paragraph-1"}',
        ],
        import.meta.url,
      );
      expect(stdout).toContain("Set cursor in space");
    });

    it("simulates lock acquisition for collaborative editing", async function () {
      const { stdout } = await runCommand(
        [
          "spaces",
          "locks",
          "acquire",
          testSpaceId,
          "paragraph-1",
          "--data",
          '{"operation":"edit","timeout":30000}',
        ],
        import.meta.url,
      );
      expect(stdout).toContain("Successfully acquired lock");
    });
  });

  describe("Real-time state synchronization", function () {
    const testSpaceId = "realtime-sync-space";

    it("tests member presence updates", async function () {
      const { stdout } = await runCommand(
        [
          "spaces",
          "members",
          "enter",
          testSpaceId,
          "--profile",
          '{"status":"active","currentTask":"reviewing"}',
        ],
        import.meta.url,
      );
      expect(stdout).toContain("Successfully entered space");
    });

    it("tests location state synchronization", async function () {
      const { stdout, error } = await runCommand(
        [
          "spaces",
          "locations",
          "set",
          testSpaceId,
          "--location",
          '{"x":500,"y":600,"page":"review","viewport":{"zoom":1.5}}',
        ],
        import.meta.url,
      );
      expect(stdout).toContain("Successfully set location");
    });

    it("tests cursor state synchronization", async function () {
      const { stdout } = await runCommand(
        [
          "spaces",
          "cursors",
          "set",
          testSpaceId,
          "--x",
          "300",
          "--y",
          "400",
          "--data",
          '{"isSelecting":true,"selectionStart":{"x":300,"y":400}}',
        ],
        import.meta.url,
      );
      expect(stdout).toContain("Set cursor in space");
    });

    it("tests lock state synchronization", async function () {
      const { stdout } = await runCommand(
        [
          "spaces",
          "locks",
          "acquire",
          testSpaceId,
          "shared-document",
          "--data",
          '{"lockType":"exclusive","reason":"formatting"}',
        ],
        import.meta.url,
      );
      expect(stdout).toContain("Successfully acquired lock");
    });
  });
});
