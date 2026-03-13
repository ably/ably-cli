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

/**
 * Mock the app resolution flow used by `requireAppId` / `resolveAppIdFromNameOrId`.
 * Call this **before** other nock mocks in tests that pass `--app`.
 * Mocks `GET /v1/me` and `GET /v1/accounts/{accountId}/apps`.
 */
export function mockAppResolution(appId: string): void {
  const { accountId } = getControlApiContext();
  nockControl()
    .get("/v1/me")
    .reply(200, {
      account: { id: accountId, name: "Test Account" },
      user: { email: "test@example.com" },
    });
  nockControl()
    .get(`/v1/accounts/${accountId}/apps`)
    .reply(200, [{ id: appId, name: "Test App", accountId }]);
}

/** Clean up all nock interceptors. Call in afterEach. */
export function controlApiCleanup(): void {
  nock.cleanAll();
}
