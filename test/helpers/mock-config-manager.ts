/**
 * Test helper for accessing and manipulating the MockConfigManager.
 *
 * Usage in tests:
 *   import { getMockConfigManager, resetMockConfig } from "../../helpers/mock-config-manager.js";
 *
 *   // Get the mock to manipulate it
 *   const mockConfig = getMockConfigManager();
 *   mockConfig.setCurrentAccountAlias(undefined); // Test "no account" error
 *
 *   // Reset to defaults between tests
 *   resetMockConfig();
 */

import { MockConfigManager } from "../../src/services/mock-config-manager.js";

export { DEFAULT_TEST_CONFIG } from "../../src/services/mock-config-manager.js";

/**
 * Get the MockConfigManager instance from globals.
 * Throws if not in test mode or mock not initialized.
 */
export function getMockConfigManager(): MockConfigManager {
  if (!globalThis.__TEST_MOCKS__?.configManager) {
    throw new Error(
      "MockConfigManager not initialized. Ensure you are running unit tests with the proper setup.",
    );
  }
  return globalThis.__TEST_MOCKS__.configManager;
}

/**
 * Reset the mock config manager to default values.
 * Call this in beforeEach or when you need a fresh config.
 */
export function resetMockConfig(): void {
  const mock = getMockConfigManager();
  mock.reset();
}

/**
 * Initialize the mock config manager on globals.
 * This is called by the unit test setup file.
 */
export function initializeMockConfigManager(): void {
  if (!globalThis.__TEST_MOCKS__) {
    globalThis.__TEST_MOCKS__ = {
      ablyRestMock: {},
    };
  }
  globalThis.__TEST_MOCKS__.configManager = new MockConfigManager();
}

/**
 * Check if mock config manager is available.
 */
export function hasMockConfigManager(): boolean {
  return !!globalThis.__TEST_MOCKS__?.configManager;
}
