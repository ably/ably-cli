import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";

// Define the type for global test mocks
declare global {
  var __TEST_MOCKS__: {
    ablyRealtimeMock?: unknown;
  };
}

describe("channels:presence:enter command", () => {
  let mockPresenceEnter: ReturnType<typeof vi.fn>;
  let mockPresenceGet: ReturnType<typeof vi.fn>;
  let mockPresenceLeave: ReturnType<typeof vi.fn>;
  let mockPresenceSubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockPresenceEnter = vi.fn().mockResolvedValue(null);
    mockPresenceGet = vi
      .fn()
      .mockResolvedValue([
        { clientId: "other-client", data: { status: "online" } },
      ]);
    mockPresenceLeave = vi.fn().mockResolvedValue(null);
    mockPresenceSubscribe = vi.fn();

    const mockChannel = {
      name: "test-channel",
      state: "attached",
      presence: {
        enter: mockPresenceEnter,
        get: mockPresenceGet,
        leave: mockPresenceLeave,
        subscribe: mockPresenceSubscribe,
        unsubscribe: vi.fn(),
      },
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
    };

    globalThis.__TEST_MOCKS__ = {
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
    delete globalThis.__TEST_MOCKS__;
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["channels:presence:enter", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Enter presence on a channel");
      expect(stdout).toContain("USAGE");
      expect(stdout).toContain("CHANNEL");
    });

    it("should display examples in help", async () => {
      const { stdout } = await runCommand(
        ["channels:presence:enter", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("EXAMPLES");
      expect(stdout).toContain("presence enter");
    });

    it("should show channel argument is required", async () => {
      const { stdout } = await runCommand(
        ["channels:presence:enter", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("CHANNEL");
    });
  });

  describe("presence enter functionality", () => {
    it("should enter presence on a channel", async () => {
      const { stdout } = await runCommand(
        [
          "channels:presence:enter",
          "test-channel",
          "--api-key",
          "app.key:secret",
        ],
        import.meta.url,
      );

      // Should show successful entry
      expect(stdout).toContain("test-channel");
      expect(stdout).toContain("Entered");
      // Verify presence.enter was called
      expect(mockPresenceEnter).toHaveBeenCalled();
    });

    it("should enter presence with data", async () => {
      const { stdout } = await runCommand(
        [
          "channels:presence:enter",
          "test-channel",
          "--api-key",
          "app.key:secret",
          "--data",
          '{"status":"online","name":"TestUser"}',
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Entered");
      // Verify presence.enter was called with the data
      expect(mockPresenceEnter).toHaveBeenCalledWith({
        status: "online",
        name: "TestUser",
      });
    });

    it("should list current presence members after entering", async () => {
      const { stdout } = await runCommand(
        [
          "channels:presence:enter",
          "test-channel",
          "--api-key",
          "app.key:secret",
        ],
        import.meta.url,
      );

      // Should show presence members
      expect(stdout).toContain("other-client");
      expect(mockPresenceGet).toHaveBeenCalled();
    });

    it("should run with --json flag without errors", async () => {
      const { error } = await runCommand(
        [
          "channels:presence:enter",
          "test-channel",
          "--api-key",
          "app.key:secret",
          "--json",
        ],
        import.meta.url,
      );

      // Should not have errors - command runs successfully in JSON mode
      expect(error).toBeUndefined();
      // Verify presence.enter was still called
      expect(mockPresenceEnter).toHaveBeenCalled();
    });

    it("should handle invalid JSON data gracefully", async () => {
      const { error } = await runCommand(
        [
          "channels:presence:enter",
          "test-channel",
          "--api-key",
          "app.key:secret",
          "--data",
          "not-valid-json",
        ],
        import.meta.url,
      );

      // Should throw an error for invalid JSON
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/invalid|json/i);
    });

    it("should subscribe to presence events and display them", async () => {
      // Set up the mock to capture the callback and trigger a presence event
      let presenceCallback: ((message: unknown) => void) | undefined;
      mockPresenceSubscribe.mockImplementation(
        (callback: (message: unknown) => void) => {
          presenceCallback = callback;
          // Trigger a presence event after a short delay
          setTimeout(() => {
            callback({
              action: "enter",
              clientId: "another-client",
              data: { status: "active" },
              timestamp: Date.now(),
            });
          }, 50);
        },
      );

      const { stdout } = await runCommand(
        [
          "channels:presence:enter",
          "test-channel",
          "--api-key",
          "app.key:secret",
        ],
        import.meta.url,
      );

      // Should have subscribed to presence events
      expect(mockPresenceSubscribe).toHaveBeenCalled();
      expect(presenceCallback).toBeDefined();

      // Verify the presence event was displayed
      expect(stdout).toContain("another-client");
      expect(stdout).toContain("enter");
    });
  });

  describe("flags", () => {
    it("should accept --data flag", async () => {
      const { stdout } = await runCommand(
        ["channels:presence:enter", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--data");
    });

    it("should accept --json flag", async () => {
      const { stdout } = await runCommand(
        ["channels:presence:enter", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--json");
    });

    it("should accept --duration flag", async () => {
      const { stdout } = await runCommand(
        ["channels:presence:enter", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--duration");
    });
  });
});
