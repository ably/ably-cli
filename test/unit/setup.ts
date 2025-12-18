/**
 * Unit test setup file.
 *
 * This file is loaded before each unit test file and sets up centralized
 * mocks for ConfigManager, Ably Realtime, Ably REST, Ably Spaces, and Ably Chat.
 *
 * Tests can import the getMock* and resetMock* functions to access and
 * manipulate the mocks on a per-test basis.
 */

import { beforeAll, beforeEach, vi } from "vitest";
import {
  initializeMockConfigManager,
  resetMockConfig,
} from "../helpers/mock-config-manager.js";
import {
  initializeMockAblyRealtime,
  resetMockAblyRealtime,
} from "../helpers/mock-ably-realtime.js";
import {
  initializeMockAblyRest,
  resetMockAblyRest,
} from "../helpers/mock-ably-rest.js";
import {
  initializeMockAblySpaces,
  resetMockAblySpaces,
} from "../helpers/mock-ably-spaces.js";
import {
  initializeMockAblyChat,
  resetMockAblyChat,
} from "../helpers/mock-ably-chat.js";

// Initialize all mocks once at the start of unit tests
beforeAll(() => {
  initializeMockConfigManager();
  initializeMockAblyRealtime();
  initializeMockAblyRest();
  initializeMockAblySpaces();
  initializeMockAblyChat();
});

// Reset all mocks before each test to ensure clean state
beforeEach(() => {
  // Clear all mock call history once (centralized)
  vi.clearAllMocks();

  // Reset each mock's internal state
  resetMockConfig();
  resetMockAblyRealtime();
  resetMockAblyRest();
  resetMockAblySpaces();
  resetMockAblyChat();
});
