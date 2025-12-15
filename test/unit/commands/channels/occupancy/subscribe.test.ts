import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";

describe("channels:occupancy:subscribe command", () => {
  beforeEach(() => {
    // Clean up any previous test mocks
    if (globalThis.__TEST_MOCKS__) {
      delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
    }
  });

  afterEach(() => {
    // Only delete the mock we added, not the whole object
    if (globalThis.__TEST_MOCKS__) {
      delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
    }
  });

  describe("command arguments and flags", () => {
    it("should require channel argument", async () => {
      const { error } = await runCommand(
        ["channels:occupancy:subscribe"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });

    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["channels:occupancy:subscribe", "test-channel", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("subscription behavior", () => {
    it("should subscribe to occupancy events and show initial message", async () => {
      const mockChannel = {
        name: "test-channel",
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        on: vi.fn(),
        detach: vi.fn(),
      };

      const mockChannels = {
        get: vi.fn().mockReturnValue(mockChannel),
        release: vi.fn(),
      };

      const mockConnection = {
        on: vi.fn(),
        once: vi.fn(),
        state: "connected",
      };

      // Merge with existing mocks (don't overwrite configManager)
      globalThis.__TEST_MOCKS__ = {
        ...globalThis.__TEST_MOCKS__,
        ablyRealtimeMock: {
          channels: mockChannels,
          connection: mockConnection,
          close: vi.fn(),
        },
      };

      // Command will exit after ABLY_CLI_DEFAULT_DURATION (1 second)
      const { stdout } = await runCommand(
        ["channels:occupancy:subscribe", "test-channel"],
        import.meta.url,
      );

      expect(stdout).toContain("Subscribing to occupancy events on channel");
      expect(stdout).toContain("test-channel");
      expect(mockChannels.get).toHaveBeenCalledWith("test-channel", {
        params: { occupancy: "metrics" },
      });
    });

    it("should get channel with occupancy params enabled", async () => {
      const mockChannel = {
        name: "test-channel",
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        on: vi.fn(),
        detach: vi.fn(),
      };

      const mockChannels = {
        get: vi.fn().mockReturnValue(mockChannel),
        release: vi.fn(),
      };

      const mockConnection = {
        on: vi.fn(),
        once: vi.fn(),
        state: "connected",
      };

      // Merge with existing mocks (don't overwrite configManager)
      globalThis.__TEST_MOCKS__ = {
        ...globalThis.__TEST_MOCKS__,
        ablyRealtimeMock: {
          channels: mockChannels,
          connection: mockConnection,
          close: vi.fn(),
        },
      };

      // Command will exit after ABLY_CLI_DEFAULT_DURATION (1 second)
      await runCommand(
        ["channels:occupancy:subscribe", "test-channel"],
        import.meta.url,
      );

      // Verify channel was gotten with occupancy params
      expect(mockChannels.get).toHaveBeenCalledWith("test-channel", {
        params: {
          occupancy: "metrics",
        },
      });
    });

    it("should subscribe to [meta]occupancy event", async () => {
      const mockChannel = {
        name: "test-channel",
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        on: vi.fn(),
        detach: vi.fn(),
      };

      const mockChannels = {
        get: vi.fn().mockReturnValue(mockChannel),
        release: vi.fn(),
      };

      const mockConnection = {
        on: vi.fn(),
        once: vi.fn(),
        state: "connected",
      };

      // Merge with existing mocks (don't overwrite configManager)
      globalThis.__TEST_MOCKS__ = {
        ...globalThis.__TEST_MOCKS__,
        ablyRealtimeMock: {
          channels: mockChannels,
          connection: mockConnection,
          close: vi.fn(),
        },
      };

      // Command will exit after ABLY_CLI_DEFAULT_DURATION (1 second)
      await runCommand(
        ["channels:occupancy:subscribe", "test-channel"],
        import.meta.url,
      );

      // Verify subscribe was called with the correct event name
      expect(mockChannel.subscribe).toHaveBeenCalledWith(
        "[meta]occupancy",
        expect.any(Function),
      );
    });
  });

  describe("error handling", () => {
    it("should handle subscription errors gracefully", async () => {
      const mockChannel = {
        name: "test-channel",
        subscribe: vi.fn().mockImplementation(() => {
          throw new Error("Subscription failed");
        }),
        unsubscribe: vi.fn(),
        on: vi.fn(),
        detach: vi.fn(),
      };

      const mockChannels = {
        get: vi.fn().mockReturnValue(mockChannel),
        release: vi.fn(),
      };

      const mockConnection = {
        on: vi.fn(),
        once: vi.fn(),
        state: "connected",
      };

      // Merge with existing mocks (don't overwrite configManager)
      globalThis.__TEST_MOCKS__ = {
        ...globalThis.__TEST_MOCKS__,
        ablyRealtimeMock: {
          channels: mockChannels,
          connection: mockConnection,
          close: vi.fn(),
        },
      };

      const { error } = await runCommand(
        ["channels:occupancy:subscribe", "test-channel"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Subscription failed/i);
    });

    it("should handle missing mock client in test mode", async () => {
      // Clear the realtime mock but keep configManager
      if (globalThis.__TEST_MOCKS__) {
        delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
      }

      const { error } = await runCommand(
        ["channels:occupancy:subscribe", "test-channel"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No mock|client/i);
    });
  });

  describe("output formats", () => {
    it("should accept --json flag", async () => {
      const mockChannel = {
        name: "test-channel",
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        on: vi.fn(),
        detach: vi.fn(),
      };

      const mockChannels = {
        get: vi.fn().mockReturnValue(mockChannel),
        release: vi.fn(),
      };

      const mockConnection = {
        on: vi.fn(),
        once: vi.fn(),
        state: "connected",
      };

      // Merge with existing mocks (don't overwrite configManager)
      globalThis.__TEST_MOCKS__ = {
        ...globalThis.__TEST_MOCKS__,
        ablyRealtimeMock: {
          channels: mockChannels,
          connection: mockConnection,
          close: vi.fn(),
        },
      };

      // Command will exit after ABLY_CLI_DEFAULT_DURATION (1 second)
      // Should not throw for --json flag
      const { error } = await runCommand(
        ["channels:occupancy:subscribe", "test-channel", "--json"],
        import.meta.url,
      );

      // No flag-related error should occur
      expect(error?.message || "").not.toMatch(/unknown|Nonexistent flag/i);
    });
  });
});
