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
export interface MockRestAnnotations {
  publish: Mock;
  delete: Mock;
  get: Mock;
}

export interface MockRestChannel {
  name: string;
  publish: Mock;
  history: Mock;
  status: Mock;
  getMessage: Mock;
  updateMessage: Mock;
  deleteMessage: Mock;
  appendMessage: Mock;
  presence: MockRestPresence;
  annotations: MockRestAnnotations;
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
      listChannels: Mock;
      save: Mock;
      remove: Mock;
      removeWhere: Mock;
    };
    deviceRegistrations: {
      list: Mock;
      get: Mock;
      save: Mock;
      remove: Mock;
      removeWhere: Mock;
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
    get: vi.fn().mockResolvedValue(createMockPaginatedResult([])),
    history: vi.fn().mockResolvedValue(createMockPaginatedResult([])),
  };
}

/**
 * Create a mock REST annotations object.
 */
function createMockRestAnnotations(): MockRestAnnotations {
  return {
    publish: vi.fn().mockResolvedValue(),
    delete: vi.fn().mockResolvedValue(),
    get: vi.fn().mockResolvedValue({ items: [] }),
  };
}

/**
 * Create a mock REST channel object.
 */
function createMockRestChannel(name: string): MockRestChannel {
  return {
    name,
    publish: vi.fn().mockResolvedValue({ serials: ["mock-serial-001"] }),
    history: vi.fn().mockResolvedValue(createMockPaginatedResult([])),
    getMessage: vi.fn().mockResolvedValue({
      id: "mock-message-id",
      name: "mock-event",
      data: { hello: "world" },
      encoding: "json",
      extras: { headers: { foo: "bar" } },
      serial: "mock-serial-001",
      timestamp: 1_700_000_000_000,
      clientId: "mock-client",
      connectionId: "mock-connection",
      action: "message.update",
      version: {
        serial: "mock-serial-001@v2",
        timestamp: 1_700_000_001_000,
        clientId: "mock-editor",
        description: "Fixed typo",
      },
      annotations: {
        summary: {
          "reaction:distinct.v1": { unique: 3 },
        },
      },
    }),
    updateMessage: vi
      .fn()
      .mockResolvedValue({ versionSerial: "mock-version-serial-update" }),
    deleteMessage: vi
      .fn()
      .mockResolvedValue({ versionSerial: "mock-version-serial-delete" }),
    appendMessage: vi
      .fn()
      .mockResolvedValue({ versionSerial: "mock-version-serial-append" }),
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
    annotations: createMockRestAnnotations(),
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
        list: vi.fn().mockResolvedValue(createMockPaginatedResult([])),
        listChannels: vi.fn().mockResolvedValue(createMockPaginatedResult([])),
        save: vi.fn().mockImplementation(async () => {}),
        remove: vi.fn().mockImplementation(async () => {}),
        removeWhere: vi.fn().mockImplementation(async () => {}),
      },
      deviceRegistrations: {
        list: vi.fn().mockResolvedValue(createMockPaginatedResult([])),
        get: vi.fn().mockResolvedValue(null),
        save: vi.fn().mockImplementation(async () => {}),
        remove: vi.fn().mockImplementation(async () => {}),
        removeWhere: vi.fn().mockImplementation(async () => {}),
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
      ...createMockPaginatedResult([]),
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
    },
  };

  return mock;
}

/**
 * Create a mock PaginatedResult-like object for testing pagination.
 * Supports arbitrary page chains: pass additional arrays for subsequent pages.
 *
 * @example
 * createMockPaginatedResult([1, 2])                    // single page
 * createMockPaginatedResult([1, 2], [3, 4])            // two pages
 * createMockPaginatedResult([1, 2], [3, 4], [5, 6])   // three pages
 */
export function createMockPaginatedResult<T>(
  items: T[],
  ...remainingPages: T[][]
): {
  items: T[];
  hasNext: () => boolean;
  next: () => Promise<ReturnType<typeof createMockPaginatedResult<T>> | null>;
  isLast: () => boolean;
  first: () => Promise<ReturnType<typeof createMockPaginatedResult<T>>>;
  current: () => Promise<ReturnType<typeof createMockPaginatedResult<T>>>;
} {
  const hasNextPage = remainingPages.length > 0;
  const result = {
    items,
    hasNext: () => hasNextPage,
    next: async () => {
      if (!hasNextPage) return null;
      const [nextItems, ...rest] = remainingPages;
      return createMockPaginatedResult<T>(nextItems, ...rest);
    },
    isLast: () => !hasNextPage,
    first: async () => result,
    current: async () => result,
  };
  return result;
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
 * Also restores the mock to globalThis if it was deleted.
 */
export function resetMockAblyRest(): void {
  if (mockInstance) {
    mockInstance._reset();
  } else {
    mockInstance = createMockAblyRest();
  }
  // Ensure globalThis mock is restored (in case a test deleted it)
  globalThis.__TEST_MOCKS__ = {
    ...globalThis.__TEST_MOCKS__,
    ablyRestMock: mockInstance,
  };
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
