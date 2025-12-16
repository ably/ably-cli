/**
 * Mock Ably Chat SDK for unit tests.
 *
 * This provides a centralized mock that tests can manipulate on a per-test basis.
 * Uses vi.fn() for all methods to allow assertions and customization.
 *
 * NOTE: Initialization and reset are handled automatically by test/unit/setup.ts.
 * You do NOT need to call initializeMockAblyChat() or resetMockAblyChat()
 * in your tests - just use getMockAblyChat() to access and configure the mock.
 *
 * @example
 * import { RoomStatus } from "@ably/chat";
 *
 * // Get the mock and configure it for your test
 * const mock = getMockAblyChat();
 * const room = mock.rooms._getRoom("my-room");
 *
 * // Status setter auto-emits events, so custom attach just sets status:
 * room.attach.mockImplementation(async () => {
 *   room.status = RoomStatus.Attached;  // Automatically emits 'statusChange'
 * });
 *
 * // Capture subscription callbacks
 * let messageCallback;
 * room.messages.subscribe.mockImplementation((cb) => {
 *   messageCallback = cb;
 *   return { unsubscribe: vi.fn() };
 * });
 */

import { vi, type Mock } from "vitest";
import {
  RoomStatus,
  type Message,
  type MessageReactionEvent,
  type PresenceEvent,
  type TypingEvent,
  type Reaction,
  type OccupancyEvent,
  type ConnectionStatusChange,
} from "@ably/chat";
import { EventEmitter, type AblyEventEmitter } from "./ably-event-emitter.js";

// We use Ably's EventEmitter to match the SDK's API (on/off/once/emit)
/* eslint-disable unicorn/prefer-event-target */
import {
  getMockAblyRealtime,
  type MockAblyRealtime,
} from "./mock-ably-realtime.js";

/**
 * Mock room messages type.
 */
export interface MockRoomMessages {
  subscribe: Mock;
  send: Mock;
  get: Mock;
  reactions: MockMessageReactions;
  // Internal emitter for simulating events
  _emitter: AblyEventEmitter;
  // Helper to emit message events
  _emit: (message: Message) => void;
}

/**
 * Mock message reactions type.
 */
export interface MockMessageReactions {
  subscribe: Mock;
  add: Mock;
  remove: Mock;
  // Internal emitter for simulating events
  _emitter: AblyEventEmitter;
  // Helper to emit reaction events
  _emit: (reaction: MessageReactionEvent) => void;
}

/**
 * Mock room presence type.
 */
export interface MockRoomPresence {
  subscribe: Mock;
  enter: Mock;
  leave: Mock;
  update: Mock;
  get: Mock;
  // Internal emitter for simulating events
  _emitter: AblyEventEmitter;
  // Helper to emit presence events
  _emit: (presence: PresenceEvent) => void;
}

/**
 * Mock room typing type.
 */
export interface MockRoomTyping {
  subscribe: Mock;
  start: Mock;
  stop: Mock;
  get: Mock;
  // Internal emitter for simulating events
  _emitter: AblyEventEmitter;
  // Helper to emit typing events
  _emit: (typing: TypingEvent) => void;
}

/**
 * Mock room reactions type.
 */
export interface MockRoomReactions {
  subscribe: Mock;
  send: Mock;
  // Internal emitter for simulating events
  _emitter: AblyEventEmitter;
  // Helper to emit reaction events
  _emit: (reaction: Reaction) => void;
}

/**
 * Mock room occupancy type.
 */
export interface MockRoomOccupancy {
  subscribe: Mock;
  get: Mock;
  // Internal emitter for simulating events
  _emitter: AblyEventEmitter;
  // Helper to emit occupancy events
  _emit: (occupancy: OccupancyEvent) => void;
}

/**
 * Mock room type.
 */
export interface MockRoom {
  roomId: string;
  status: RoomStatus;
  error: unknown;
  messages: MockRoomMessages;
  presence: MockRoomPresence;
  typing: MockRoomTyping;
  reactions: MockRoomReactions;
  occupancy: MockRoomOccupancy;
  attach: Mock;
  detach: Mock;
  onStatusChange: Mock;
  offStatusChange: Mock;
  // Internal emitter for status changes
  _statusEmitter: AblyEventEmitter;
  // Helper to emit status changes
  _emitStatusChange: (status: RoomStatus, error?: unknown) => void;
  // Helper to set status
  _setStatus: (status: RoomStatus) => void;
}

/**
 * Mock rooms collection type.
 */
export interface MockRooms {
  get: Mock;
  release: Mock;
  // Internal map of rooms
  _rooms: Map<string, MockRoom>;
  // Helper to get or create a room
  _getRoom: (roomId: string) => MockRoom;
}

/**
 * Mock connection status type.
 */
export interface MockConnectionStatus {
  current: string;
  onStatusChange: Mock;
  offStatusChange: Mock;
  // Internal emitter for status changes
  _emitter: AblyEventEmitter;
  // Helper to emit connection status changes
  _emit: (change: ConnectionStatusChange) => void;
}

/**
 * Mock client options type.
 */
export interface MockClientOptions {
  logLevel?: string;
  logHandler?: (message: string) => void;
}

/**
 * Mock Ably Chat client type.
 */
export interface MockAblyChat {
  rooms: MockRooms;
  connection: MockConnectionStatus;
  clientOptions: MockClientOptions;
  clientId: string;
  // Reference to the underlying realtime client
  realtime: MockAblyRealtime;
  // Helper to reset all mocks to default state
  _reset: () => void;
}

/**
 * Create a mock message reactions object.
 */
function createMockMessageReactions(): MockMessageReactions {
  const emitter = new EventEmitter();

  return {
    subscribe: vi.fn((callback) => {
      emitter.on("reaction", callback);
      return () => emitter.off("reaction", callback);
    }),
    add: vi.fn().mockImplementation(async () => {}),
    remove: vi.fn().mockImplementation(async () => {}),
    _emitter: emitter,
    _emit: (reaction: MessageReactionEvent) => {
      emitter.emit("reaction", reaction);
    },
  };
}

/**
 * Create a mock room messages object.
 */
function createMockRoomMessages(): MockRoomMessages {
  const emitter = new EventEmitter();

  return {
    subscribe: vi.fn((callback) => {
      emitter.on("message", callback);
      return { unsubscribe: () => emitter.off("message", callback) };
    }),
    send: vi.fn().mockResolvedValue({
      serial: "mock-serial",
      createdAt: Date.now(),
    }),
    get: vi.fn().mockResolvedValue({ items: [] }),
    reactions: createMockMessageReactions(),
    _emitter: emitter,
    _emit: (message: Message) => {
      emitter.emit("message", message);
    },
  };
}

/**
 * Create a mock room presence object.
 */
function createMockRoomPresence(): MockRoomPresence {
  const emitter = new EventEmitter();

  return {
    subscribe: vi.fn((callback) => {
      emitter.on("presence", callback);
      return {
        unsubscribe: () => emitter.off("presence", callback),
      };
    }),
    enter: vi.fn().mockImplementation(async () => {}),
    leave: vi.fn().mockImplementation(async () => {}),
    update: vi.fn().mockImplementation(async () => {}),
    get: vi.fn().mockResolvedValue([]),
    _emitter: emitter,
    _emit: (presence: PresenceEvent) => {
      emitter.emit("presence", presence);
    },
  };
}

/**
 * Create a mock room typing object.
 */
function createMockRoomTyping(): MockRoomTyping {
  const emitter = new EventEmitter();

  return {
    subscribe: vi.fn((callback) => {
      emitter.on("typing", callback);
      return { unsubscribe: () => emitter.off("typing", callback) };
    }),
    start: vi.fn().mockImplementation(async () => {}),
    stop: vi.fn().mockImplementation(async () => {}),
    get: vi.fn().mockResolvedValue(new Set()),
    _emitter: emitter,
    _emit: (typing: TypingEvent) => {
      emitter.emit("typing", typing);
    },
  };
}

/**
 * Create a mock room reactions object.
 */
function createMockRoomReactions(): MockRoomReactions {
  const emitter = new EventEmitter();

  return {
    subscribe: vi.fn((callback) => {
      emitter.on("reaction", callback);
      return {
        unsubscribe: () => emitter.off("reaction", callback),
      };
    }),
    send: vi.fn().mockImplementation(async () => {}),
    _emitter: emitter,
    _emit: (reaction: Reaction) => {
      emitter.emit("reaction", reaction);
    },
  };
}

/**
 * Create a mock room occupancy object.
 */
function createMockRoomOccupancy(): MockRoomOccupancy {
  const emitter = new EventEmitter();

  return {
    subscribe: vi.fn((callback) => {
      emitter.on("occupancy", callback);
      return {
        unsubscribe: () => emitter.off("occupancy", callback),
      };
    }),
    get: vi.fn().mockResolvedValue({
      connections: 0,
      presenceMembers: 0,
    }),
    _emitter: emitter,
    _emit: (occupancy: OccupancyEvent) => {
      emitter.emit("occupancy", occupancy);
    },
  };
}

/**
 * Create a mock room object.
 *
 * The `status` setter automatically emits status change events, so custom
 * implementations of attach/detach only need to set the status:
 *
 * @example
 * // Custom attach that fails
 * room.attach.mockImplementation(async () => {
 *   room.status = RoomStatus.Failed;
 *   throw new Error("Failed to attach");
 * });
 */
function createMockRoom(roomId: string): MockRoom {
  const statusEmitter = new EventEmitter();
  let roomStatus: RoomStatus = RoomStatus.Initialized;
  let roomError: unknown = null;

  const room: MockRoom = {
    roomId,
    get status() {
      return roomStatus;
    },
    set status(value: RoomStatus) {
      const previous = roomStatus;
      roomStatus = value;
      // Automatically emit status change events
      statusEmitter.emit("statusChange", {
        current: value,
        previous,
        error: roomError,
      });
    },
    get error() {
      return roomError;
    },
    set error(value: unknown) {
      roomError = value;
    },
    messages: createMockRoomMessages(),
    presence: createMockRoomPresence(),
    typing: createMockRoomTyping(),
    reactions: createMockRoomReactions(),
    occupancy: createMockRoomOccupancy(),
    attach: vi.fn(),
    detach: vi.fn(),
    onStatusChange: vi.fn((callback) => {
      statusEmitter.on("statusChange", callback);
      return () => statusEmitter.off("statusChange", callback);
    }),
    offStatusChange: vi.fn((callback) => {
      if (callback) {
        statusEmitter.off("statusChange", callback);
      } else {
        statusEmitter.off("statusChange");
      }
    }),
    _statusEmitter: statusEmitter,
    _emitStatusChange: (status: RoomStatus, error?: unknown) => {
      roomError = error ?? null;
      room.status = status;
    },
    _setStatus: (status: RoomStatus) => {
      room.status = status;
    },
  };

  // Bind attach/detach to room so they use the auto-emitting setter
  room.attach = vi.fn().mockImplementation(async () => {
    room.status = RoomStatus.Attached;
  });
  room.detach = vi.fn().mockImplementation(async () => {
    room.status = RoomStatus.Detached;
  });

  return room;
}

/**
 * Create a mock rooms collection.
 */
function createMockRooms(): MockRooms {
  const roomsMap = new Map<string, MockRoom>();

  const getRoom = (roomId: string): MockRoom => {
    if (!roomsMap.has(roomId)) {
      roomsMap.set(roomId, createMockRoom(roomId));
    }
    return roomsMap.get(roomId)!;
  };

  return {
    get: vi.fn(async (roomId: string) => getRoom(roomId)),
    release: vi.fn(async (roomId: string) => {
      roomsMap.delete(roomId);
    }),
    _rooms: roomsMap,
    _getRoom: getRoom,
  };
}

/**
 * Create a mock connection status.
 */
function createMockConnectionStatus(): MockConnectionStatus {
  const emitter = new EventEmitter();

  return {
    current: "connected",
    onStatusChange: vi.fn((callback) => {
      emitter.on("statusChange", callback);
      return () => emitter.off("statusChange", callback);
    }),
    offStatusChange: vi.fn((callback) => {
      if (callback) {
        emitter.off("statusChange", callback);
      } else {
        emitter.off("statusChange");
      }
    }),
    _emitter: emitter,
    _emit: (change: ConnectionStatusChange) => {
      emitter.emit("statusChange", change);
    },
  };
}

/**
 * Create a mock Ably Chat client.
 */
function createMockAblyChat(): MockAblyChat {
  const rooms = createMockRooms();
  const connection = createMockConnectionStatus();
  const realtime = getMockAblyRealtime();

  const mock: MockAblyChat = {
    rooms,
    connection,
    clientOptions: {},
    clientId: "mock-client-id",
    realtime,
    _reset: () => {
      rooms._rooms.clear();
      connection.current = "connected";
      vi.clearAllMocks();
    },
  };

  return mock;
}

// Singleton instance
let mockInstance: MockAblyChat | null = null;

/**
 * Get the MockAblyChat instance.
 * Creates a new instance if one doesn't exist.
 */
export function getMockAblyChat(): MockAblyChat {
  if (!mockInstance) {
    mockInstance = createMockAblyChat();
  }
  return mockInstance;
}

/**
 * Reset the mock to default state.
 * Call this in beforeEach to ensure clean state between tests.
 */
export function resetMockAblyChat(): void {
  if (mockInstance) {
    mockInstance._reset();
  } else {
    mockInstance = createMockAblyChat();
  }
}

/**
 * Initialize the mock on globals for the test setup.
 */
export function initializeMockAblyChat(): void {
  if (!mockInstance) {
    mockInstance = createMockAblyChat();
  }
  globalThis.__TEST_MOCKS__ = {
    ...globalThis.__TEST_MOCKS__,
    ablyChatMock: mockInstance,
  };
}
