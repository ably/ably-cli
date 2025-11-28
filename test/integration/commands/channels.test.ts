import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";

// Create a more comprehensive mock for Ably client
const mockPresenceMembers = [
  { clientId: "user1", data: { name: "User 1" } },
  { clientId: "user2", data: { name: "User 2" } },
];

const mockMessages = [
  {
    name: "event1",
    data: { text: "Test message 1" },
    timestamp: Date.now() - 10000,
    clientId: "user1",
  },
  {
    name: "event2",
    data: { text: "Test message 2" },
    timestamp: Date.now() - 5000,
    clientId: "user2",
  },
];

const mockOccupancyMetrics = {
  metrics: {
    connections: 5,
    publishers: 2,
    subscribers: 3,
    presenceConnections: 2,
    presenceMembers: 2,
  },
};

// More comprehensive mock Ably client
const mockClient = {
  request: () => {
    // Return channel list response
    return {
      statusCode: 200,
      items: [
        {
          channelId: "test-channel-1",
          status: { occupancy: mockOccupancyMetrics },
        },
        { channelId: "test-channel-2" },
      ],
    };
  },
  channels: {
    get: () => ({
      name: "test-channel-1",
      publish: async () => true,
      history: () => {
        // Return channel history response
        return {
          items: mockMessages,
        };
      },
      on: () => {},
      presence: {
        get: () => mockPresenceMembers,
        enter: async () => true,
        leave: async () => true,
        subscribe: (callback: (message: any) => void) => {
          // Simulate presence update
          setTimeout(() => {
            callback({
              action: "enter",
              clientId: "user3",
              data: { name: "User 3" },
            });
          }, 100);
        },
      },
      subscribe: (eventName: string, callback: (message: any) => void) => {
        // Simulate message received
        setTimeout(() => {
          callback({ name: "message", data: { text: "New message" } });
        }, 100);
      },
    }),
  },
  connection: {
    once: (event: string, callback: () => void) => {
      if (event === "connected") {
        setTimeout(callback, 0);
      }
    },
    on: () => {},
  },
  stats: async () => {
    return {
      items: [
        {
          inbound: {},
          outbound: {},
          persisted: {},
          connections: {},
          channels: 5,
          apiRequests: 120,
          tokenRequests: 10,
        },
      ],
    };
  },
  close: () => {
    // Mock close method
  },
  auth: {
    clientId: "foo",
  },
};

// Pre-define variables used in tests to avoid linter errors
const publishFlowUniqueChannel = `test-channel-${Date.now()}`;
const publishFlowUniqueMessage = `Test message ${Date.now()}`;
const presenceFlowUniqueChannel = `test-presence-${Date.now()}`;
const presenceFlowUniqueClientId = `client-${Date.now()}`;

let originalEnv: NodeJS.ProcessEnv;

describe("Channels integration tests", function () {
  beforeEach(function () {
    // Store original env vars
    originalEnv = { ...process.env };

    // Make the mock globally available
    globalThis.__TEST_MOCKS__ = {
      ablyRealtimeMock: mockClient,
      ablyRestMock: mockClient,
    };

    // Set environment variables for this test file
    process.env.ABLY_CLI_TEST_MODE = "true";
    process.env.ABLY_API_KEY = "test.key:secret"; // Using a consistent mock key for integration tests
  });

  afterEach(function () {
    // Clean up global mock
    delete globalThis.__TEST_MOCKS__;
    // Restore original environment variables
    process.env = originalEnv;
  });

  // Core channel operations
  describe("Core channel operations", function () {
    it("lists active channels", async function () {
      const { stdout } = await runCommand(
        ["channels", "list"],
        import.meta.url,
      );

      expect(stdout).toContain("test-channel-1");
      expect(stdout).toContain("test-channel-2");
    });

    it("outputs channels list in JSON format", async function () {
      const { stdout } = await runCommand(
        ["channels", "list", "--json"],
        import.meta.url,
      );

      const output = JSON.parse(stdout);
      expect(output).toHaveProperty("channels");
      expect(Array.isArray(output.channels)).toBe(true);
      expect(output.channels.length).toBeGreaterThanOrEqual(2);
    });

    it("publishes message to a channel", async function () {
      const { stdout } = await runCommand(
        ["channels", "publish", "test-channel-1", '{"text":"Hello World"}'],
        import.meta.url,
      );

      expect(stdout).toContain("Message published successfully");
      expect(stdout).toContain("test-channel-1");
    });

    it("retrieves channel history", async function () {
      const { stdout } = await runCommand(
        ["channels", "history", "test-channel-1"],
        import.meta.url,
      );

      expect(stdout).toContain("Test message 1");
      expect(stdout).toContain("Test message 2");
    });
  });

  // Presence operations
  describe("Presence operations", function () {
    it("enters channel presence", async function () {
      const { stdout } = await runCommand(
        [
          "channels",
          "presence",
          "enter",
          "test-channel-1",
          "--client-id",
          "test-client",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Entered channel");
      expect(stdout).toContain("test-channel-1");
    });
  });

  // Occupancy operations
  describe("Occupancy operations", function () {
    it("gets channel occupancy metrics", async function () {
      const { stdout } = await runCommand(
        ["channels", "occupancy", "get", "test-channel-1"],
        import.meta.url,
      );

      expect(stdout).toContain("test-channel-1");
      expect(stdout).toContain("Connections: 5");
      expect(stdout).toContain("Publishers: 2");
      expect(stdout).toContain("Subscribers: 3");
      expect(stdout).toContain("Presence Members: 2");
    });
  });

  // Batch operations
  describe("Batch operations", function () {
    it("batch publishes to multiple channels", async function () {
      const { stdout } = await runCommand(
        [
          "channels",
          "batch-publish",
          "--channels",
          "test-channel-1,test-channel-2",
          '{"text":"Batch Message"}',
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Batch publish successful");
      expect(stdout).toContain("test-channel-1");
      expect(stdout).toContain("test-channel-2");
    });
  });

  // Test flow: Publish -> history
  describe("Publish to history flow", function () {
    // We need to split these into separate tests rather than using .do() which causes linter errors
    it("publishes message then retrieves it in history", async function () {
      const { stdout } = await runCommand(
        [
          "channels",
          "publish",
          publishFlowUniqueChannel,
          `{"text":"${publishFlowUniqueMessage}"}`,
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Message published successfully");
    });

    it("retrieves published message from history", async function () {
      const { stdout } = await runCommand(
        ["channels", "history", publishFlowUniqueChannel],
        import.meta.url,
      );

      // In the real world the message would be in history, but in our mock
      // we're just checking that history command was executed correctly
      expect(stdout).toContain("Found 2 messages");
    });
  });

  // Test flow: Presence enter -> presence list
  describe("Presence enter to list flow", function () {
    // We need to split these into separate tests rather than using .do() which causes linter errors
    it("enters presence on unique channel", async function () {
      const { stdout } = await runCommand(
        [
          "channels",
          "presence",
          "enter",
          presenceFlowUniqueChannel,
          "--client-id",
          presenceFlowUniqueClientId,
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Entered channel " + presenceFlowUniqueChannel);
    });
  });

  // Connection monitoring operations
  describe("Connection monitoring operations", function () {
    it("retrieves connection stats with default parameters", async function () {
      const { stdout } = await runCommand(
        ["connections", "stats"],
        import.meta.url,
      );

      expect(stdout).toContain("Connections:");
      expect(stdout).toContain("Channels:");
      expect(stdout).toContain("Messages:");
    });

    it("retrieves connection stats in JSON format", async function () {
      const { stdout } = await runCommand(
        ["connections", "stats", "--json"],
        import.meta.url,
      );

      const output = JSON.parse(stdout);
      expect(output).toHaveProperty("inbound");
      expect(output).toHaveProperty("outbound");
      expect(output).toHaveProperty("connections");
    });

    it("retrieves connection stats with custom time range", async function () {
      const { stdout } = await runCommand(
        [
          "connections",
          "stats",
          "--start",
          Date.now(),
          "--end",
          Date.now() + 10000,
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Stats for");
    });

    it("retrieves connection stats with different time units", async function () {
      const { stdout } = await runCommand(
        ["connections", "stats", "--unit", "hour", "--limit", "5"],
        import.meta.url,
      );

      expect(stdout).toContain("Connections:");
      expect(stdout).toContain("Channels:");
    });
  });

  // Error recovery scenarios
  describe("Error recovery scenarios", function () {
    it("handles channel operations with invalid channel names gracefully", async function () {
      const { error } = await runCommand(
        ["channels", "history", ""],
        import.meta.url,
      );
      expect(error.oclif.exit).toBe(2);
    });

    it("handles connection stats with invalid parameters gracefully", async function () {
      const { error } = await runCommand(
        ["connections", "stats", "--start", "invalid-timestamp"],
        import.meta.url,
      );
      expect(error.oclif.exit).toBe(2);
    });
  });
});
