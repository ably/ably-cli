/**
 * Unit test setup file.
 *
 * This file is loaded before each unit test file and sets up the
 * MockConfigManager for tests that need config access.
 */

import { beforeAll, beforeEach } from "vitest";
import {
  initializeMockConfigManager,
  resetMockConfig,
} from "../helpers/mock-config-manager.js";

// Initialize the mock config manager once at the start of unit tests
beforeAll(() => {
  initializeMockConfigManager();
});

// Reset the mock config before each test to ensure clean state
beforeEach(() => {
  resetMockConfig();
});
