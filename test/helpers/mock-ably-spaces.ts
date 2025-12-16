/**
 * Mock Ably Spaces SDK for unit tests.
 *
 * This provides a centralized mock that tests can manipulate on a per-test basis.
 * Uses vi.fn() for all methods to allow assertions and customization.
 *
 * NOTE: Initialization and reset are handled automatically by test/unit/setup.ts.
 * You do NOT need to call initializeMockAblySpaces() or resetMockAblySpaces()
 * in your tests - just use getMockAblySpaces() to access and configure the mock.
 *
 * @example
 * // Get the mock and configure it for your test
 * const mock = getMockAblySpaces();
 * const space = mock._getSpace("my-space");
 * space.members.getAll.mockResolvedValue([{ clientId: "user1" }]);
 *
 * // Capture subscription callbacks
 * let memberCallback;
 * space.members.subscribe.mockImplementation((event, cb) => {
 *   memberCallback = cb;
 * });
 */

import { vi, type Mock } from "vitest";
import type {
  SpaceMember,
  CursorUpdate,
  Lock,
  LocationsEvents,
} from "@ably/spaces";
import { EventEmitter, type AblyEventEmitter } from "./ably-event-emitter.js";

// We use Ably's EventEmitter to match the SDK's API (on/off/once/emit)
/* eslint-disable unicorn/prefer-event-target */

/**
 * Mock space members type.
 */
export interface MockSpaceMembers {
  subscribe: Mock;
  unsubscribe: Mock;
  getAll: Mock;
  getSelf: Mock;
  // Internal emitter for simulating events
  _emitter: AblyEventEmitter;
  // Helper to emit member events
  _emit: (member: SpaceMember) => void;
}

/**
 * Mock space locations type.
 */
export interface MockSpaceLocations {
  set: Mock;
  getAll: Mock;
  getSelf: Mock;
  subscribe: Mock;
  unsubscribe: Mock;
  // Internal emitter for simulating events
  _emitter: AblyEventEmitter;
  // Helper to emit location events
  _emit: (update: LocationsEvents.UpdateEvent) => void;
}

/**
 * Mock space locks type.
 */
export interface MockSpaceLocks {
  acquire: Mock;
  release: Mock;
  get: Mock;
  getAll: Mock;
  subscribe: Mock;
  unsubscribe: Mock;
  // Internal emitter for simulating events
  _emitter: AblyEventEmitter;
  // Helper to emit lock events
  _emit: (lock: Lock) => void;
}

/**
 * Mock space cursors type.
 */
export interface MockSpaceCursors {
  set: Mock;
  getAll: Mock;
  subscribe: Mock;
  unsubscribe: Mock;
  // Internal emitter for simulating events
  _emitter: AblyEventEmitter;
  // Helper to emit cursor events
  _emit: (cursor: CursorUpdate) => void;
}

/**
 * Mock space type.
 */
export interface MockSpace {
  name: string;
  enter: Mock;
  leave: Mock;
  updateProfileData: Mock;
  members: MockSpaceMembers;
  locations: MockSpaceLocations;
  locks: MockSpaceLocks;
  cursors: MockSpaceCursors;
}

/**
 * Mock Ably Spaces SDK type.
 */
export interface MockAblySpaces {
  get: Mock;
  // Internal map of spaces
  _spaces: Map<string, MockSpace>;
  // Helper to get or create a space
  _getSpace: (name: string) => MockSpace;
  // Helper to reset all mocks to default state
  _reset: () => void;
}

/**
 * Create a mock space members object.
 */
function createMockSpaceMembers(): MockSpaceMembers {
  const emitter = new EventEmitter();

  return {
    subscribe: vi.fn((eventOrCallback, callback?) => {
      const cb = callback ?? eventOrCallback;
      const event = callback ? eventOrCallback : null;
      emitter.on(event, cb);
      return Promise.resolve();
    }),
    unsubscribe: vi.fn((eventOrCallback?, callback?) => {
      if (!eventOrCallback) {
        emitter.off();
      } else if (typeof eventOrCallback === "function") {
        emitter.off(null, eventOrCallback);
      } else if (callback) {
        emitter.off(eventOrCallback, callback);
      }
      return Promise.resolve();
    }),
    getAll: vi.fn().mockResolvedValue([]),
    getSelf: vi.fn().mockResolvedValue({
      clientId: "mock-client-id",
      connectionId: "mock-connection-id",
      isConnected: true,
      profileData: {},
    }),
    _emitter: emitter,
    _emit: (member: SpaceMember) => {
      emitter.emit(member.lastEvent.name, member);
    },
  };
}

/**
 * Create a mock space locations object.
 */
function createMockSpaceLocations(): MockSpaceLocations {
  const emitter = new EventEmitter();

  return {
    set: vi.fn().mockImplementation(async () => {}),
    getAll: vi.fn().mockResolvedValue([]),
    getSelf: vi.fn().mockResolvedValue(null),
    subscribe: vi.fn((eventOrCallback, callback?) => {
      const cb = callback ?? eventOrCallback;
      const event = callback ? eventOrCallback : null;
      emitter.on(event, cb);
    }),
    unsubscribe: vi.fn((eventOrCallback?, callback?) => {
      if (!eventOrCallback) {
        emitter.off();
      } else if (typeof eventOrCallback === "function") {
        emitter.off(null, eventOrCallback);
      } else if (callback) {
        emitter.off(eventOrCallback, callback);
      }
    }),
    _emitter: emitter,
    _emit: (update: LocationsEvents.UpdateEvent) => {
      emitter.emit("update", update);
    },
  };
}

/**
 * Create a mock space locks object.
 */
function createMockSpaceLocks(): MockSpaceLocks {
  const emitter = new EventEmitter();

  return {
    acquire: vi.fn().mockResolvedValue({ id: "mock-lock-id" }),
    release: vi.fn().mockImplementation(async () => {}),
    get: vi.fn().mockResolvedValue(null),
    getAll: vi.fn().mockResolvedValue([]),
    subscribe: vi.fn((eventOrCallback, callback?) => {
      const cb = callback ?? eventOrCallback;
      const event = callback ? eventOrCallback : null;
      emitter.on(event, cb);
    }),
    unsubscribe: vi.fn((eventOrCallback?, callback?) => {
      if (!eventOrCallback) {
        emitter.off();
      } else if (typeof eventOrCallback === "function") {
        emitter.off(null, eventOrCallback);
      } else if (callback) {
        emitter.off(eventOrCallback, callback);
      }
    }),
    _emitter: emitter,
    _emit: (lock: Lock) => {
      emitter.emit("update", lock);
    },
  };
}

/**
 * Create a mock space cursors object.
 */
function createMockSpaceCursors(): MockSpaceCursors {
  const emitter = new EventEmitter();

  return {
    set: vi.fn().mockImplementation(async () => {}),
    getAll: vi.fn().mockResolvedValue([]),
    subscribe: vi.fn((eventOrCallback, callback?) => {
      const cb = callback ?? eventOrCallback;
      const event = callback ? eventOrCallback : null;
      emitter.on(event, cb);
    }),
    unsubscribe: vi.fn((eventOrCallback?, callback?) => {
      if (!eventOrCallback) {
        emitter.off();
      } else if (typeof eventOrCallback === "function") {
        emitter.off(null, eventOrCallback);
      } else if (callback) {
        emitter.off(eventOrCallback, callback);
      }
    }),
    _emitter: emitter,
    _emit: (cursor: CursorUpdate) => {
      emitter.emit("update", cursor);
    },
  };
}

/**
 * Create a mock space object.
 */
function createMockSpace(name: string): MockSpace {
  return {
    name,
    enter: vi.fn().mockImplementation(async () => {}),
    leave: vi.fn().mockImplementation(async () => {}),
    updateProfileData: vi.fn().mockImplementation(async () => {}),
    members: createMockSpaceMembers(),
    locations: createMockSpaceLocations(),
    locks: createMockSpaceLocks(),
    cursors: createMockSpaceCursors(),
  };
}

/**
 * Create a mock Ably Spaces SDK.
 */
function createMockAblySpaces(): MockAblySpaces {
  const spacesMap = new Map<string, MockSpace>();

  const getSpace = (name: string): MockSpace => {
    if (!spacesMap.has(name)) {
      spacesMap.set(name, createMockSpace(name));
    }
    return spacesMap.get(name)!;
  };

  const mock: MockAblySpaces = {
    get: vi.fn(async (name: string) => getSpace(name)),
    _spaces: spacesMap,
    _getSpace: getSpace,
    _reset: () => {
      spacesMap.clear();
      vi.clearAllMocks();
    },
  };

  return mock;
}

// Singleton instance
let mockInstance: MockAblySpaces | null = null;

/**
 * Get the MockAblySpaces instance.
 * Creates a new instance if one doesn't exist.
 */
export function getMockAblySpaces(): MockAblySpaces {
  if (!mockInstance) {
    mockInstance = createMockAblySpaces();
  }
  return mockInstance;
}

/**
 * Reset the mock to default state.
 * Call this in beforeEach to ensure clean state between tests.
 */
export function resetMockAblySpaces(): void {
  if (mockInstance) {
    mockInstance._reset();
  } else {
    mockInstance = createMockAblySpaces();
  }
}

/**
 * Initialize the mock on globals for the test setup.
 */
export function initializeMockAblySpaces(): void {
  if (!mockInstance) {
    mockInstance = createMockAblySpaces();
  }
  globalThis.__TEST_MOCKS__ = {
    ...globalThis.__TEST_MOCKS__,
    ablySpacesMock: mockInstance,
  };
}
