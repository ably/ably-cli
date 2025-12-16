/**
 * Mock Ably Realtime client for unit tests.
 *
 * This provides a centralized mock that tests can manipulate on a per-test basis.
 * Uses vi.fn() for all methods to allow assertions and customization.
 *
 * NOTE: Initialization and reset are handled automatically by test/unit/setup.ts.
 * You do NOT need to call initializeMockAblyRealtime() or resetMockAblyRealtime()
 * in your tests - just use getMockAblyRealtime() to access and configure the mock.
 *
 * @example
 * // Get the mock and configure it for your test
 * const mock = getMockAblyRealtime();
 * const channel = mock.channels._getChannel("my-channel");
 * channel.history.mockResolvedValue({ items: [...] });
 *
 * // State setters auto-emit events, so custom attach just sets state:
 * channel.attach.mockImplementation(async () => {
 *   channel.state = "attached";  // Automatically emits 'attached' and 'stateChange'
 * });
 */

import { vi, type Mock } from "vitest";
import type { Message, PresenceMessage, ConnectionStateChange } from "ably";
import { EventEmitter, type AblyEventEmitter } from "./ably-event-emitter.js";

// We use Ably's EventEmitter to match the SDK's API (on/off/once/emit)
/* eslint-disable unicorn/prefer-event-target */

/**
 * Mock channel type with all common methods.
 */
export interface MockRealtimeChannel {
  name: string;
  state: string;
  subscribe: Mock;
  unsubscribe: Mock;
  publish: Mock;
  history: Mock;
  attach: Mock;
  detach: Mock;
  on: Mock;
  off: Mock;
  once: Mock;
  setOptions: Mock;
  presence: MockPresence;
  // Internal emitter for simulating events
  _emitter: AblyEventEmitter;
  // Helper to emit message events
  _emit: (message: Message) => void;
}

/**
 * Mock presence type.
 */
export interface MockPresence {
  enter: Mock;
  leave: Mock;
  update: Mock;
  get: Mock;
  subscribe: Mock;
  unsubscribe: Mock;
  history: Mock;
  // Internal emitter for simulating events
  _emitter: AblyEventEmitter;
  // Helper to emit presence events
  _emit: (message: PresenceMessage) => void;
}

/**
 * Mock connection type.
 */
export interface MockConnection {
  id: string;
  state: string;
  errorReason: unknown;
  on: Mock;
  off: Mock;
  once: Mock;
  connect: Mock;
  close: Mock;
  ping: Mock;
  // Internal emitter for simulating events
  _emitter: AblyEventEmitter;
  // Helper to emit connection state change events
  _emit: (stateChange: ConnectionStateChange) => void;
  // Helper to change state
  _setState: (state: string, reason?: unknown) => void;
}

/**
 * Mock channels collection type.
 */
export interface MockChannels {
  get: Mock;
  release: Mock;
  // Internal map of channels
  _channels: Map<string, MockRealtimeChannel>;
  // Helper to get or create a channel
  _getChannel: (name: string) => MockRealtimeChannel;
}

/**
 * Mock auth type.
 */
export interface MockAuth {
  clientId: string;
  authorize: Mock;
  createTokenRequest: Mock;
  requestToken: Mock;
}

/**
 * Mock Ably Realtime client type.
 */
export interface MockAblyRealtime {
  channels: MockChannels;
  connection: MockConnection;
  auth: MockAuth;
  close: Mock;
  connect: Mock;
  time: Mock;
  stats: Mock;
  // Helper to reset all mocks to default state
  _reset: () => void;
}

/**
 * Create a mock presence object.
 */
function createMockPresence(): MockPresence {
  const emitter = new EventEmitter();

  const presence: MockPresence = {
    enter: vi.fn().mockImplementation(async () => {}),
    leave: vi.fn().mockImplementation(async () => {}),
    update: vi.fn().mockImplementation(async () => {}),
    get: vi.fn().mockResolvedValue([]),
    subscribe: vi.fn((eventOrCallback, callback) => {
      // Handle both (callback) and (event, callback) signatures
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
    history: vi.fn().mockResolvedValue({ items: [] }),
    _emitter: emitter,
    _emit: (message: PresenceMessage) => {
      emitter.emit(message.action, message);
    },
  };

  return presence;
}

/**
 * Create a mock channel object.
 *
 * The `state` setter automatically emits state change events, so custom
 * implementations of attach/detach only need to set the state:
 *
 * @example
 * // Custom attach that fails
 * channel.attach.mockImplementation(async () => {
 *   channel.state = "failed";
 *   throw new Error("Failed to attach");
 * });
 */
function createMockChannel(name: string): MockRealtimeChannel {
  const emitter = new EventEmitter();
  let channelState = "initialized";

  const channel: MockRealtimeChannel = {
    name,
    get state() {
      return channelState;
    },
    set state(value: string) {
      const previous = channelState;
      channelState = value;
      // Automatically emit state change events
      emitter.emit(value, { current: value, previous });
      emitter.emit("stateChange", { current: value, previous });
    },
    subscribe: vi.fn((eventOrCallback, callback?) => {
      // Handle both (callback) and (event, callback) signatures
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
    publish: vi.fn().mockImplementation(async () => {}),
    history: vi.fn().mockResolvedValue({ items: [] }),
    attach: vi.fn().mockImplementation(async function (
      this: MockRealtimeChannel,
    ) {
      this.state = "attached";
    }),
    detach: vi.fn().mockImplementation(async function (
      this: MockRealtimeChannel,
    ) {
      this.state = "detached";
    }),
    on: vi.fn((eventOrListener, listener?) => {
      const event = listener ? eventOrListener : null;
      const cb = listener ?? eventOrListener;
      emitter.on(event, cb);
    }),
    off: vi.fn((eventOrListener?, listener?) => {
      if (!eventOrListener) {
        emitter.off();
      } else if (typeof eventOrListener === "function") {
        emitter.off(null, eventOrListener);
      } else if (listener) {
        emitter.off(eventOrListener, listener);
      }
    }),
    once: vi.fn((eventOrListener, listener?) => {
      const event = listener ? eventOrListener : null;
      const cb = listener ?? eventOrListener;
      emitter.once(event, cb);
    }),
    setOptions: vi.fn().mockImplementation(async () => {}),
    presence: createMockPresence(),
    _emitter: emitter,
    _emit: (message: Message) => {
      emitter.emit(message.name || "", message);
    },
  };

  // Bind attach/detach to channel so `this` works correctly
  channel.attach = vi.fn().mockImplementation(async () => {
    channel.state = "attached";
  });
  channel.detach = vi.fn().mockImplementation(async () => {
    channel.state = "detached";
  });

  return channel;
}

/**
 * Create a mock channels collection.
 */
function createMockChannels(): MockChannels {
  const channelsMap = new Map<string, MockRealtimeChannel>();

  const getChannel = (name: string): MockRealtimeChannel => {
    if (!channelsMap.has(name)) {
      channelsMap.set(name, createMockChannel(name));
    }
    return channelsMap.get(name)!;
  };

  const channels: MockChannels = {
    get: vi.fn((name: string) => getChannel(name)),
    release: vi.fn((name: string) => {
      channelsMap.delete(name);
    }),
    _channels: channelsMap,
    _getChannel: getChannel,
  };

  return channels;
}

/**
 * Create a mock connection object.
 *
 * The `state` setter automatically emits state change events, so custom
 * implementations of connect/close only need to set the state:
 *
 * @example
 * // Simulate connection failure
 * connection.connect.mockImplementation(() => {
 *   connection.errorReason = new Error("Connection failed");
 *   connection.state = "failed";
 * });
 */
function createMockConnection(): MockConnection {
  const emitter = new EventEmitter();
  let connectionState = "connected";
  let connectionErrorReason: unknown = null;

  const connection: MockConnection = {
    id: "mock-connection-id",
    get state() {
      return connectionState;
    },
    set state(value: string) {
      const previous = connectionState;
      connectionState = value;
      // Automatically emit state change events
      emitter.emit(value, {
        current: value,
        previous,
        reason: connectionErrorReason,
      });
      emitter.emit("stateChange", {
        current: value,
        previous,
        reason: connectionErrorReason,
      });
    },
    get errorReason() {
      return connectionErrorReason;
    },
    set errorReason(value: unknown) {
      connectionErrorReason = value;
    },
    on: vi.fn((eventOrListener, listener?) => {
      const event = listener ? eventOrListener : null;
      const cb = listener ?? eventOrListener;
      emitter.on(event, cb);
    }),
    off: vi.fn((eventOrListener?, listener?) => {
      if (!eventOrListener) {
        emitter.off();
      } else if (typeof eventOrListener === "function") {
        emitter.off(null, eventOrListener);
      } else if (listener) {
        emitter.off(eventOrListener, listener);
      }
    }),
    once: vi.fn((eventOrListener, listener?) => {
      const event = listener ? eventOrListener : null;
      const cb = listener ?? eventOrListener;
      emitter.once(event, cb);
    }),
    connect: vi.fn(),
    close: vi.fn(),
    ping: vi.fn().mockResolvedValue(10),
    _emitter: emitter,
    _emit: (stateChange: ConnectionStateChange) => {
      emitter.emit(stateChange.current, stateChange);
    },
    _setState: (state: string, reason?: unknown) => {
      connectionErrorReason = reason ?? null;
      connection.state = state;
    },
  };

  // Bind connect/close to connection so they use the auto-emitting setter
  connection.connect = vi.fn(() => {
    connection.state = "connected";
  });
  connection.close = vi.fn(() => {
    connection.state = "closed";
  });

  return connection;
}

/**
 * Create a mock auth object.
 */
function createMockAuth(): MockAuth {
  return {
    clientId: "mock-client-id",
    authorize: vi.fn().mockResolvedValue({
      token: "mock-token",
      expires: Date.now() + 3600000,
    }),
    createTokenRequest: vi.fn().mockResolvedValue({
      keyName: "mock-key",
      ttl: 3600000,
      timestamp: Date.now(),
      nonce: "mock-nonce",
    }),
    requestToken: vi.fn().mockResolvedValue({
      token: "mock-token",
      expires: Date.now() + 3600000,
    }),
  };
}

/**
 * Create a mock Ably Realtime client.
 */
function createMockAblyRealtime(): MockAblyRealtime {
  const channels = createMockChannels();
  const connection = createMockConnection();
  const auth = createMockAuth();

  const mock: MockAblyRealtime = {
    channels,
    connection,
    auth,
    close: vi.fn(() => {
      connection.state = "closed";
    }),
    connect: vi.fn(() => {
      connection.state = "connected";
    }),
    time: vi.fn().mockResolvedValue(Date.now()),
    stats: vi.fn().mockResolvedValue({ items: [] }),
    _reset: () => {
      // Clear all channels
      channels._channels.clear();
      // Reset connection state
      connection.state = "connected";
      connection.errorReason = null;
      // Reset auth
      auth.clientId = "mock-client-id";
      // Clear all mock call history
      vi.clearAllMocks();
    },
  };

  return mock;
}

// Singleton instance
let mockInstance: MockAblyRealtime | null = null;

/**
 * Get the MockAblyRealtime instance.
 * Creates a new instance if one doesn't exist.
 */
export function getMockAblyRealtime(): MockAblyRealtime {
  if (!mockInstance) {
    mockInstance = createMockAblyRealtime();
  }
  return mockInstance;
}

/**
 * Reset the mock to default state.
 * Call this in beforeEach to ensure clean state between tests.
 */
export function resetMockAblyRealtime(): void {
  if (mockInstance) {
    mockInstance._reset();
  } else {
    mockInstance = createMockAblyRealtime();
  }
}

/**
 * Initialize the mock on globals for the test setup.
 */
export function initializeMockAblyRealtime(): void {
  if (!mockInstance) {
    mockInstance = createMockAblyRealtime();
  }
  globalThis.__TEST_MOCKS__ = {
    ...globalThis.__TEST_MOCKS__,
    ablyRealtimeMock: mockInstance,
  };
}
