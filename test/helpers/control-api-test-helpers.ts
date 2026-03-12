/**
 * Shared helpers for Control API test files that use nock.
 */
import nock from "nock";
import { getMockConfigManager } from "./mock-config-manager.js";

/** The default Control API host used in tests. */
export const CONTROL_HOST = "https://control.ably.net";

/** Create a nock scope for the Control API host. */
export function nockControl(): nock.Scope {
  return nock(CONTROL_HOST);
}

/**
 * Get common Control API test context values from MockConfigManager.
 * Call this at describe-level or in beforeEach.
 */
export function getControlApiContext() {
  const mock = getMockConfigManager();
  return {
    accountId: mock.getCurrentAccount()!.accountId!,
    appId: mock.getCurrentAppId()!,
    mock,
  };
}

/** Clean up all nock interceptors. Call in afterEach. */
export function controlApiCleanup(): void {
  nock.cleanAll();
}
