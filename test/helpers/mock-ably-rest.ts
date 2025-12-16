/**
 * Mock Ably REST client for unit tests.
 *
 * This provides a centralized mock that tests can manipulate on a per-test basis.
 * Uses vi.fn() for all methods to allow assertions and customization.
 *
 * NOTE: Initialization and reset are handled automatically by test/unit/setup.ts.
 * You do NOT need to call initializeMockAblyRest() or resetMockAblyRest()
 * in your tests - just use getMockAblyRest() to access and configure the mock.
 *
 * @example
 * // Get the mock and configure it for your test
 * const mock = getMockAblyRest();
 * const channel = mock.channels._getChannel("my-channel");
 * channel.history.mockResolvedValue({ items: [...] });
 *
 * // Override publish behavior
 * channel.publish.mockRejectedValue(new Error("Publish failed"));
 */

import { vi, type Mock } from "vitest";

/**
 * Mock REST channel type with all common methods.
 */
export interface MockRestChannel {
  name: string;
  publish: Mock;
  history: Mock;
  status: Mock;
  presence: MockRestPresence;
}

/**
 * Mock REST presence type.
 */
export interface MockRestPresence {
  get: Mock;
  history: Mock;
}

/**
 * Mock REST channels collection type.
 */
export interface MockRestChannels {
  get: Mock;
  // Internal map of channels
  _channels: Map<string, MockRestChannel>;
  // Helper to get or create a channel
  _getChannel: (name: string) => MockRestChannel;
}

/**
 * Mock REST auth type.
 */
export interface MockRestAuth {
  clientId: string;
  createTokenRequest: Mock;
  requestToken: Mock;
}

/**
 * Mock request type for REST API calls.
 */
export interface MockRequest {
  request: Mock;
}

/**
 * Mock push type for REST push notifications.
 */
export interface MockPush {
  admin: {
    publish: Mock;
    channelSubscriptions: {
      list: Mock;
      save: Mock;
      remove: Mock;
    };
    deviceRegistrations: {
      list: Mock;
      get: Mock;
      save: Mock;
      remove: Mock;
    };
  };
}

/**
 * Mock Ably REST client type.
 */
export interface MockAblyRest {
  channels: MockRestChannels;
  auth: MockRestAuth;
  request: Mock;
  time: Mock;
  stats: Mock;
  push: MockPush;
  // Helper to reset all mocks to default state
  _reset: () => void;
}

/**
 * Create a mock REST presence object.
 */
function createMockRestPresence(): MockRestPresence {
  return {
    get: vi.fn().mockResolvedValue({ items: [] }),
    history: vi.fn().mockResolvedValue({ items: [] }),
  };
}

/**
 * Create a mock REST channel object.
 */
function createMockRestChannel(name: string): MockRestChannel {
  return {
    name,
    publish: vi.fn().mockImplementation(async () => {}),
    history: vi.fn().mockResolvedValue({ items: [] }),
    status: vi.fn().mockResolvedValue({
      channelId: name,
      status: {
        isActive: true,
        occupancy: {
          metrics: {
            connections: 0,
            presenceConnections: 0,
            presenceMembers: 0,
            presenceSubscribers: 0,
            publishers: 0,
            subscribers: 0,
          },
        },
      },
    }),
    presence: createMockRestPresence(),
  };
}

/**
 * Create a mock REST channels collection.
 */
function createMockRestChannels(): MockRestChannels {
  const channelsMap = new Map<string, MockRestChannel>();

  const getChannel = (name: string): MockRestChannel => {
    if (!channelsMap.has(name)) {
      channelsMap.set(name, createMockRestChannel(name));
    }
    return channelsMap.get(name)!;
  };

  return {
    get: vi.fn((name: string) => getChannel(name)),
    _channels: channelsMap,
    _getChannel: getChannel,
  };
}

/**
 * Create a mock REST auth object.
 */
function createMockRestAuth(): MockRestAuth {
  return {
    clientId: "mock-client-id",
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
 * Create a mock push object.
 */
function createMockPush(): MockPush {
  return {
    admin: {
      publish: vi.fn().mockImplementation(async () => {}),
      channelSubscriptions: {
        list: vi.fn().mockResolvedValue({ items: [] }),
        save: vi.fn().mockImplementation(async () => {}),
        remove: vi.fn().mockImplementation(async () => {}),
      },
      deviceRegistrations: {
        list: vi.fn().mockResolvedValue({ items: [] }),
        get: vi.fn().mockResolvedValue(null),
        save: vi.fn().mockImplementation(async () => {}),
        remove: vi.fn().mockImplementation(async () => {}),
      },
    },
  };
}

/**
 * Create a mock Ably REST client.
 */
function createMockAblyRest(): MockAblyRest {
  const channels = createMockRestChannels();
  const auth = createMockRestAuth();
  const push = createMockPush();

  const mock: MockAblyRest = {
    channels,
    auth,
    request: vi.fn().mockResolvedValue({
      items: [],
      statusCode: 200,
      success: true,
    }),
    time: vi.fn().mockResolvedValue(Date.now()),
    stats: vi.fn().mockResolvedValue({ items: [] }),
    push,
    _reset: () => {
      // Clear all channels
      channels._channels.clear();
      // Reset auth
      auth.clientId = "mock-client-id";
      // Clear all mock call history
      vi.clearAllMocks();
    },
  };

  return mock;
}

// Singleton instance
let mockInstance: MockAblyRest | null = null;

/**
 * Get the MockAblyRest instance.
 * Creates a new instance if one doesn't exist.
 */
export function getMockAblyRest(): MockAblyRest {
  if (!mockInstance) {
    mockInstance = createMockAblyRest();
  }
  return mockInstance;
}

/**
 * Reset the mock to default state.
 * Call this in beforeEach to ensure clean state between tests.
 */
export function resetMockAblyRest(): void {
  if (mockInstance) {
    mockInstance._reset();
  } else {
    mockInstance = createMockAblyRest();
  }
}

/**
 * Initialize the mock on globals for the test setup.
 */
export function initializeMockAblyRest(): void {
  if (!mockInstance) {
    mockInstance = createMockAblyRest();
  }
  globalThis.__TEST_MOCKS__ = {
    ...globalThis.__TEST_MOCKS__,
    ablyRestMock: mockInstance,
  };
}
