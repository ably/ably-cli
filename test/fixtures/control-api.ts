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
    created: 1640995200000,
    modified: 1640995200000,
    source: { channelFilter: "^test", type: "channel.message" },
    target: { url: "https://example.com/webhook" },
    ...overrides,
  };
}
