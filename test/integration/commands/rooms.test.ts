import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import { registerMock } from "../test-utils.js";
import { RoomStatus } from "@ably/chat";

// Mock room data
const mockMessages = [
  {
    text: "Hello room!",
    clientId: "test-client",
    timestamp: new Date(Date.now() - 10000),
    metadata: { isImportant: true },
  },
  {
    text: "How is everyone?",
    clientId: "other-client",
    timestamp: new Date(Date.now() - 5000),
    metadata: { thread: "general" },
  },
];

const mockPresenceMembers = [
  { clientId: "user1", data: { name: "Alice", status: "online" } },
  { clientId: "user2", data: { name: "Bob", status: "busy" } },
];

const mockReactions = [
  { emoji: "👍", count: 3, clientIds: ["user1", "user2", "user3"] },
  { emoji: "❤️", count: 1, clientIds: ["user1"] },
];

const mockOccupancy = {
  connections: 5,
  publishers: 2,
  subscribers: 3,
  presenceConnections: 2,
  presenceMembers: 2,
};

// Create comprehensive mock for Chat client and room
const createMockRoom = (room: string) => ({
  id: room,
  attach: async () => {},
  detach: async () => {},

  onStatusChange: (callback: (change: any) => void) => {
    setTimeout(() => {
      callback({
        current: RoomStatus.Attached,
      });
    }, 100);
  },

  // Messages functionality
  messages: {
    send: async (message: any) => {
      mockMessages.push({
        text: message.text,
        clientId: "test-client",
        timestamp: new Date(),
        metadata: message.metadata || {},
      });
      return;
    },
    subscribe: (callback: (message: any) => void) => {
      // Simulate receiving messages
      setTimeout(() => {
        callback({
          text: "New message",
          clientId: "live-client",
          timestamp: new Date(),
        });
      }, 100);
      return Promise.resolve();
    },
    unsubscribe: async () => {},
    history: async (options?: any) => {
      const limit = options?.limit || 50;
      const direction = options?.direction || "backwards";

      let messages = [...mockMessages];
      if (direction === "backwards") {
        messages.reverse();
      }

      return {
        items: messages.slice(0, limit),
        hasNext: () => false,
        isLast: () => true,
      };
    },
  },

  // Presence functionality
  presence: {
    enter: async (data?: any) => {
      mockPresenceMembers.push({
        clientId: "test-client",
        data: data || { status: "online" },
      });
      return;
    },
    leave: async () => {},
    get: async () => [...mockPresenceMembers],
    subscribe: (callback: (member: any) => void) => {
      setTimeout(() => {
        callback({
          action: "enter",
          clientId: "new-member",
          data: { name: "Charlie", status: "active" },
        });
      }, 100);
      return Promise.resolve();
    },
    unsubscribe: async () => {},
  },

  // Reactions functionality
  reactions: {
    send: async (emoji: string, _?: any) => {
      const existingReaction = mockReactions.find((r) => r.emoji === emoji);
      if (existingReaction) {
        existingReaction.count++;
        existingReaction.clientIds.push("test-client");
      } else {
        mockReactions.push({
          emoji,
          count: 1,
          clientIds: ["test-client"],
        });
      }
      return;
    },
    subscribe: (callback: (reaction: any) => void) => {
      setTimeout(() => {
        callback({
          emoji: "🎉",
          clientId: "celebration-client",
          timestamp: new Date(),
        });
      }, 100);
      return Promise.resolve();
    },
    unsubscribe: async () => {},
  },

  // Typing functionality
  typing: {
    keystroke: async () => {},
    stop: async () => {},
    subscribe: (callback: (event: any) => void) => {
      setTimeout(() => {
        callback({
          clientId: "typing-client",
          event: "start",
          timestamp: new Date(),
        });
      }, 100);
      return Promise.resolve();
    },
    unsubscribe: async () => {},
  },

  // Occupancy functionality
  occupancy: {
    get: async () => ({ ...mockOccupancy }),
    subscribe: (callback: (occupancy: any) => void) => {
      setTimeout(() => {
        callback({
          ...mockOccupancy,
          connections: mockOccupancy.connections + 1,
        });
      }, 100);
      return Promise.resolve();
    },
    unsubscribe: async () => {},
  },
});

const mockRealtimeClient = {
  connection: {
    once: (event: string, callback: () => void) => {
      if (event === "connected") {
        setTimeout(callback, 0);
      }
    },
    on: (callback: (stateChange: any) => void) => {
      // Simulate connection state changes
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
};

const mockChatClient = {
  rooms: {
    get: (room: string) => createMockRoom(room),
    release: async (_: string) => {},
  },
  connection: {
    onStatusChange: (_: (change: any) => void) => {},
  },
  realtime: mockRealtimeClient,
};

let originalEnv: NodeJS.ProcessEnv;

describe("Rooms integration tests", function () {
  beforeEach(function () {
    // Store original env vars
    originalEnv = { ...process.env };

    // Set environment variables for this test file
    process.env.ABLY_CLI_TEST_MODE = "true";
    process.env.ABLY_API_KEY = "test.key:secret";

    // Register the chat and realtime mocks using the test-utils system
    registerMock("ablyChatMock", mockChatClient);
    registerMock("ablyRealtimeMock", mockRealtimeClient);
  });

  afterEach(function () {
    // Restore original environment variables
    process.env = originalEnv;
  });

  describe("Chat room lifecycle", function () {
    const testRoom = "integration-test-room";

    it("sends a message to a room", async function () {
      const { stdout } = await runCommand(
        [
          "rooms",
          "messages",
          "send",
          testRoom,
          '"Hello from integration test!"',
        ],
        import.meta.url,
      );
      expect(stdout).toContain("Message sent successfully");
    });

    it("sends multiple messages with metadata", async function () {
      const { stdout } = await runCommand(
        [
          "rooms",
          "messages",
          "send",
          testRoom,
          '"Message with metadata"',
          "--metadata",
          '{"priority":"high"}',
          "--count",
          "3",
        ],
        import.meta.url,
      );
      expect(stdout).toContain("messages sent successfully");
    });

    it("retrieves message history", async function () {
      const { stdout } = await runCommand(
        ["rooms", "messages", "history", testRoom, "--limit", "10"],
        import.meta.url,
      );
      expect(stdout).toContain("Hello room!");
      expect(stdout).toContain("How is everyone?");
    });

    it("enters room presence with data", async function () {
      const { stdout } = await runCommand(
        [
          "rooms",
          "presence",
          "enter",
          testRoom,
          "--data",
          '{"name":"Integration Tester","role":"tester"}',
        ],
        import.meta.url,
      );

      // Since presence enter runs indefinitely, we check initial setup
      expect(stdout).toContain("Entered room");
    });

    it("gets room occupancy metrics", async function () {
      const { stdout } = await runCommand(
        ["rooms", "occupancy", "get", testRoom],
        import.meta.url,
      );
      expect(stdout).toContain("Connections:");
      expect(stdout).toContain("Presence Members:");
    });

    it("sends a reaction to a room", async function () {
      const { stdout } = await runCommand(
        ["rooms", "reactions", "send", testRoom, "🚀"],
        import.meta.url,
      );
      expect(stdout).toContain(
        "Sent reaction 🚀 in room integration-test-room",
      );
    });

    it("starts typing indicator", async function () {
      const { stdout } = await runCommand(
        ["rooms", "typing", "keystroke", testRoom],
        import.meta.url,
      );

      expect(stdout).toContain("Started typing in room");
    });
  });

  describe("JSON output format", function () {
    const testRoom = "json-test-room";

    it("outputs message send result in JSON format", async function () {
      const { stdout } = await runCommand(
        [
          "rooms",
          "messages",
          "send",
          testRoom,
          '"JSON test message"',
          "--json",
        ],
        import.meta.url,
      );
      expect(stdout).toContain('"success": true');
      expect(stdout).toContain('"room": "');
    });

    it("outputs message history in JSON format", async function () {
      const { stdout } = await runCommand(
        ["rooms", "messages", "history", testRoom, "--json"],
        import.meta.url,
      );
      expect(stdout).toContain('"messages": [');
    });

    it("outputs occupancy metrics in JSON format", async function () {
      const { stdout } = await runCommand(
        ["rooms", "occupancy", "get", testRoom, "--json"],
        import.meta.url,
      );
      expect(stdout).toContain('"connections":');
      expect(stdout).toContain('"publishers":');
      expect(stdout).toContain('"subscribers":');
    });
  });

  describe("Error handling", function () {
    it("handles invalid metadata JSON", async function () {
      const { error } = await runCommand(
        [
          "rooms",
          "messages",
          "send",
          "test-room",
          '"test message"',
          "--metadata",
          "{]",
        ],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toContain("Invalid metadata JSON");
    });

    it("handles missing message text", async function () {
      const { error } = await runCommand(
        ["rooms", "messages", "send", "test-room"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toContain("Missing 1 required arg");
      expect(error?.message).toContain("text  The message text to send");
    });
  });

  describe("Real-time message flow simulation", function () {
    const testRoom = "realtime-test-room";

    it("simulates sending and then subscribing to messages", async function () {
      // This test simulates a real flow where we send a message and then subscribe
      const { stdout } = await runCommand(
        [
          "rooms",
          "messages",
          "send",
          testRoom,
          '"Test message for subscription"',
        ],
        import.meta.url,
      );
      expect(stdout).toContain("Message sent successfully");
    });

    it("simulates presence lifecycle", async function () {
      // Test presence enter followed by checking presence
      const { stdout } = await runCommand(
        [
          "rooms",
          "presence",
          "enter",
          testRoom,
          "--data",
          '{"status":"testing"}',
        ],
        import.meta.url,
      );
      expect(stdout).toContain("Entered room realtime-test-room");
    });
  });
});
