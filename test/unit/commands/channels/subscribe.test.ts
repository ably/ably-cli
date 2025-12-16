import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";

// Define the type for global test mocks
declare global {
  var __TEST_MOCKS__: {
    ablyRealtimeMock?: unknown;
  };
}

describe("channels:subscribe command", () => {
  let mockSubscribeCallback: ((message: unknown) => void) | null = null;
  let mockChannelState = "initialized";

  beforeEach(() => {
    mockSubscribeCallback = null;
    mockChannelState = "initialized";

    // Set up a mock Ably realtime client
    const mockChannel = {
      name: "test-channel",
      state: mockChannelState,
      subscribe: vi.fn((callback: (message: unknown) => void) => {
        mockSubscribeCallback = callback;
      }),
      unsubscribe: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn((event: string, callback: () => void) => {
        if (event === "attached") {
          // Simulate immediate attachment
          mockChannelState = "attached";
          setTimeout(() => callback(), 10);
        }
      }),
    };

    // Make state getter dynamic
    Object.defineProperty(mockChannel, "state", {
      get: () => mockChannelState,
    });

    // Merge with existing mocks (don't overwrite configManager)
    globalThis.__TEST_MOCKS__ = {
      ...globalThis.__TEST_MOCKS__,
      ablyRealtimeMock: {
        channels: {
          get: vi.fn().mockReturnValue(mockChannel),
        },
        connection: {
          state: "connected",
          on: vi.fn(),
          once: vi.fn((event: string, callback: () => void) => {
            if (event === "connected") {
              setTimeout(() => callback(), 5);
            }
          }),
        },
        close: vi.fn(),
        auth: {
          clientId: "test-client-id",
        },
      },
    };
  });

  afterEach(() => {
    // Call close on mock client if it exists
    const mock = globalThis.__TEST_MOCKS__?.ablyRealtimeMock as
      | { close?: () => void }
      | undefined;
    mock?.close?.();
    // Only delete the mock we added, not the whole object
    if (globalThis.__TEST_MOCKS__) {
      delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
    }
    vi.restoreAllMocks();
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["channels:subscribe", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Subscribe to");
      expect(stdout).toContain("USAGE");
      expect(stdout).toContain("--rewind");
      expect(stdout).toContain("--delta");
    });

    it("should display examples in help", async () => {
      const { stdout } = await runCommand(
        ["channels:subscribe", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("EXAMPLES");
      expect(stdout).toContain("subscribe");
    });

    it("should show channel argument is required", async () => {
      const { stdout } = await runCommand(
        ["channels:subscribe", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("CHANNELS");
    });
  });

  describe("argument validation", () => {
    it("should require at least one channel name", async () => {
      const { error } = await runCommand(
        ["channels:subscribe"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      // The error message may vary - just check an error is thrown for missing args
      expect(error?.message).toMatch(/channel|required|argument/i);
    });
  });

  describe("subscription functionality", () => {
    it("should subscribe to a channel and attach", async () => {
      const { stdout } = await runCommand(
        ["channels:subscribe", "test-channel", "--api-key", "app.key:secret"],
        import.meta.url,
      );

      // Should show successful attachment
      expect(stdout).toContain("test-channel");
      // Check we got the channel
      const mock = globalThis.__TEST_MOCKS__?.ablyRealtimeMock as {
        channels: { get: ReturnType<typeof vi.fn> };
      };
      expect(mock.channels.get).toHaveBeenCalledWith(
        "test-channel",
        expect.any(Object),
      );
    });

    it("should receive and display messages with event name and data", async () => {
      // Run command in background-like manner
      const commandPromise = runCommand(
        ["channels:subscribe", "test-channel", "--api-key", "app.key:secret"],
        import.meta.url,
      );

      // Wait for subscription to be set up
      await vi.waitFor(() => {
        expect(mockSubscribeCallback).not.toBeNull();
      });

      // Simulate receiving a message
      mockSubscribeCallback!({
        name: "test-event",
        data: "hello world",
        timestamp: Date.now(),
        id: "msg-123",
        clientId: "publisher-client",
        connectionId: "conn-456",
      });

      const { stdout } = await commandPromise;

      // Should have received and displayed the message with channel, event, and data
      expect(stdout).toContain("test-channel");
      expect(stdout).toContain("Event: test-event");
      expect(stdout).toContain("hello world");
    });

    it("should run with --json flag without errors", async () => {
      const { stdout, error } = await runCommand(
        [
          "channels:subscribe",
          "test-channel",
          "--api-key",
          "app.key:secret",
          "--json",
        ],
        import.meta.url,
      );

      // Should not have thrown an error
      expect(error).toBeUndefined();
      // In JSON mode, the command should still work (no user-friendly messages)
      // Output may be minimal since duration elapses quickly
      expect(stdout).toBeDefined();
    });
  });

  describe("flags", () => {
    it("should accept --rewind flag", async () => {
      const { stdout } = await runCommand(
        ["channels:subscribe", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--rewind");
      expect(stdout).toMatch(/rewind.*messages/i);
    });

    it("should accept --delta flag", async () => {
      const { stdout } = await runCommand(
        ["channels:subscribe", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--delta");
    });

    it("should accept --cipher-key flag", async () => {
      const { stdout } = await runCommand(
        ["channels:subscribe", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--cipher-key");
    });

    it("should accept --json flag", async () => {
      const { stdout } = await runCommand(
        ["channels:subscribe", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--json");
    });

    it("should configure channel with rewind option", async () => {
      await runCommand(
        [
          "channels:subscribe",
          "test-channel",
          "--api-key",
          "app.key:secret",
          "--rewind",
          "5",
        ],
        import.meta.url,
      );

      const mock = globalThis.__TEST_MOCKS__?.ablyRealtimeMock as {
        channels: { get: ReturnType<typeof vi.fn> };
      };
      expect(mock.channels.get).toHaveBeenCalledWith(
        "test-channel",
        expect.objectContaining({
          params: expect.objectContaining({ rewind: "5" }),
        }),
      );
    });

    it("should configure channel with delta option", async () => {
      await runCommand(
        [
          "channels:subscribe",
          "test-channel",
          "--api-key",
          "app.key:secret",
          "--delta",
        ],
        import.meta.url,
      );

      const mock = globalThis.__TEST_MOCKS__?.ablyRealtimeMock as {
        channels: { get: ReturnType<typeof vi.fn> };
      };
      expect(mock.channels.get).toHaveBeenCalledWith(
        "test-channel",
        expect.objectContaining({
          params: expect.objectContaining({ delta: "vcdiff" }),
        }),
      );
    });
  });
});
