/**
 * Mock factory functions for Control API test response bodies.
 *
 * These provide realistic default values that can be overridden per-test.
 */

export interface MockApp {
  id: string;
  accountId: string;
  name: string;
  status: string;
  created: number;
  modified: number;
  tlsOnly: boolean;
}

export function mockApp(overrides: Partial<MockApp> = {}): MockApp {
  return {
    id: "app-test-001",
    accountId: "acc-test-001",
    name: "Test App",
    status: "active",
    created: 1640995200000,
    modified: 1640995200000,
    tlsOnly: false,
    ...overrides,
  };
}

export interface MockKey {
  id: string;
  appId: string;
  name: string;
  key: string;
  capability: Record<string, string[]>;
  created: number;
  modified: number;
}

export function mockKey(overrides: Partial<MockKey> = {}): MockKey {
  return {
    id: "key-test-001",
    appId: "app-test-001",
    name: "Test Key",
    key: "app-test-001.key-test-001:secret",
    capability: { "*": ["*"] },
    created: 1640995200000,
    modified: 1640995200000,
    ...overrides,
  };
}

export interface MockRule {
  id: string;
  appId: string;
  ruleType: string;
  requestMode: string;
  status: string;
  version: string;
  created: number;
  modified: number;
  source: { channelFilter: string; type: string };
  target: Record<string, unknown>;
}

export function mockRule(overrides: Partial<MockRule> = {}): MockRule {
  return {
    id: "rule-test-001",
    appId: "app-test-001",
    ruleType: "http",
    requestMode: "single",
    status: "enabled",
    version: "1.0",
    created: 1640995200000,
    modified: 1640995200000,
    source: { channelFilter: "^test", type: "channel.message" },
    target: { url: "https://example.com/webhook" },
    ...overrides,
  };
}

export interface MockQueue {
  id: string;
  appId: string;
  name: string;
  region: string;
  state: string;
  maxLength: number;
  ttl: number;
  deadletter: boolean;
  deadletterId: string;
  messages: { ready: number; total: number; unacknowledged: number };
  stats: {
    publishRate: number | null;
    deliveryRate: number | null;
    acknowledgementRate: number | null;
  };
  amqp: { uri: string; queueName: string };
  stomp: { uri: string; host: string; destination: string };
}

export function mockQueue(overrides: Partial<MockQueue> = {}): MockQueue {
  return {
    id: "queue-test-001",
    appId: "app-test-001",
    name: "test-queue",
    region: "us-east-1-a",
    state: "active",
    maxLength: 10000,
    ttl: 60,
    deadletter: false,
    deadletterId: "",
    messages: { ready: 0, total: 0, unacknowledged: 0 },
    stats: {
      publishRate: null,
      deliveryRate: null,
      acknowledgementRate: null,
    },
    amqp: {
      uri: "amqps://queue.ably.io:5671",
      queueName: "test-queue",
    },
    stomp: {
      uri: "stomp://queue.ably.io:61614",
      host: "queue.ably.io",
      destination: "/queue/test-queue",
    },
    ...overrides,
  };
}

export interface MockNamespace {
  id: string;
  persisted: boolean;
  pushEnabled: boolean;
  created: number;
  modified: number;
}

export function mockNamespace(
  overrides: Partial<MockNamespace> = {},
): MockNamespace {
  return {
    id: "chat",
    persisted: false,
    pushEnabled: false,
    created: 1640995200000,
    modified: 1640995200000,
    ...overrides,
  };
}

export interface MockStats {
  intervalId: string;
  unit: string;
  all: {
    messages: { count: number; data: number };
    all: { count: number; data: number };
  };
}

export function mockStats(overrides: Partial<MockStats> = {}): MockStats {
  return {
    intervalId: "2023-01-01:00:00",
    unit: "minute",
    all: {
      messages: { count: 100, data: 5000 },
      all: { count: 100, data: 5000 },
    },
    ...overrides,
  };
}
