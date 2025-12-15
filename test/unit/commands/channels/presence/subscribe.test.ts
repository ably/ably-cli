import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";

// Define the type for global test mocks
declare global {
  var __TEST_MOCKS__: {
    ablyRealtimeMock?: unknown;
  };
}

describe("channels:presence:subscribe command", () => {
  let mockPresenceSubscribe: ReturnType<typeof vi.fn>;
  let mockPresenceUnsubscribe: ReturnType<typeof vi.fn>;
  let presenceCallback: ((msg: unknown) => void) | null = null;

  beforeEach(() => {
    presenceCallback = null;
    mockPresenceSubscribe = vi.fn((callback: (msg: unknown) => void) => {
      presenceCallback = callback;
    });
    mockPresenceUnsubscribe = vi.fn();

    const mockChannel = {
      name: "test-channel",
      state: "attached",
      presence: {
        subscribe: mockPresenceSubscribe,
        unsubscribe: mockPresenceUnsubscribe,
      },
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
    };

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
    // Only delete the mock we added, not the whole object
    if (globalThis.__TEST_MOCKS__) {
      delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
    }
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["channels:presence:subscribe", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Subscribe to presence events");
      expect(stdout).toContain("USAGE");
      expect(stdout).toContain("CHANNEL");
    });

    it("should display examples in help", async () => {
      const { stdout } = await runCommand(
        ["channels:presence:subscribe", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("EXAMPLES");
      expect(stdout).toContain("presence subscribe");
    });

    it("should show channel argument is required", async () => {
      const { stdout } = await runCommand(
        ["channels:presence:subscribe", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("CHANNEL");
    });
  });

  describe("presence subscription functionality", () => {
    it("should subscribe to presence events on a channel", async () => {
      const { stdout } = await runCommand(
        [
          "channels:presence:subscribe",
          "test-channel",
          "--api-key",
          "app.key:secret",
        ],
        import.meta.url,
      );

      // Should show subscription message
      expect(stdout).toContain("test-channel");
      expect(stdout).toContain("presence");
      // Verify presence.subscribe was called
      expect(mockPresenceSubscribe).toHaveBeenCalled();
    });

    it("should receive and display presence events with action, client and data", async () => {
      // Run command
      const commandPromise = runCommand(
        [
          "channels:presence:subscribe",
          "test-channel",
          "--api-key",
          "app.key:secret",
        ],
        import.meta.url,
      );

      // Wait for subscription setup using vi.waitFor
      await vi.waitFor(() => {
        expect(presenceCallback).not.toBeNull();
      });

      // Simulate receiving a presence event
      presenceCallback!({
        action: "enter",
        clientId: "other-client",
        data: { status: "online" },
        timestamp: Date.now(),
        connectionId: "conn-123",
        id: "presence-msg-123",
      });

      const { stdout } = await commandPromise;

      // Should show presence event output with action, client, and data
      expect(stdout).toContain("test-channel");
      expect(stdout).toContain("Action: enter");
      expect(stdout).toContain("Client: other-client");
      expect(stdout).toContain("online");
    });

    it("should run with --json flag without errors", async () => {
      const { error } = await runCommand(
        [
          "channels:presence:subscribe",
          "test-channel",
          "--api-key",
          "app.key:secret",
          "--json",
        ],
        import.meta.url,
      );

      // Should not have errors - command runs successfully in JSON mode
      expect(error).toBeUndefined();
      // Verify presence.subscribe was still called
      expect(mockPresenceSubscribe).toHaveBeenCalled();
    });

    it("should handle multiple presence events", async () => {
      const commandPromise = runCommand(
        [
          "channels:presence:subscribe",
          "test-channel",
          "--api-key",
          "app.key:secret",
        ],
        import.meta.url,
      );

      // Wait for subscription setup using vi.waitFor
      await vi.waitFor(() => {
        expect(presenceCallback).not.toBeNull();
      });

      // Simulate multiple presence events
      presenceCallback!({
        action: "enter",
        clientId: "user1",
        timestamp: Date.now(),
        id: "msg-1",
      });
      presenceCallback!({
        action: "leave",
        clientId: "user2",
        timestamp: Date.now(),
        id: "msg-2",
      });

      const { stdout } = await commandPromise;

      // Should have processed multiple events
      expect(stdout).toContain("test-channel");
    });
  });

  describe("flags", () => {
    it("should accept --json flag", async () => {
      const { stdout } = await runCommand(
        ["channels:presence:subscribe", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--json");
    });

    it("should accept --duration flag", async () => {
      const { stdout } = await runCommand(
        ["channels:presence:subscribe", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--duration");
    });
  });
});
