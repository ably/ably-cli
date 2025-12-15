import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";

// Define the type for global test mocks
declare global {
  var __TEST_MOCKS__: {
    ablyRealtimeMock?: unknown;
    ablyRestMock?: unknown;
  };
}

describe("benchmarking commands", { timeout: 20000 }, () => {
  let mockChannel: {
    publish: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
    presence: {
      enter: ReturnType<typeof vi.fn>;
      leave: ReturnType<typeof vi.fn>;
      get: ReturnType<typeof vi.fn>;
      subscribe: ReturnType<typeof vi.fn>;
      unsubscribe: ReturnType<typeof vi.fn>;
    };
    on: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockChannel = {
      publish: vi.fn().mockImplementation(async () => {}),
      subscribe: vi.fn(),
      unsubscribe: vi.fn().mockImplementation(async () => {}),
      presence: {
        enter: vi.fn().mockImplementation(async () => {}),
        leave: vi.fn().mockImplementation(async () => {}),
        get: vi.fn().mockResolvedValue([]),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      },
      on: vi.fn(),
    };

    // Merge with existing mocks (don't overwrite configManager)
    globalThis.__TEST_MOCKS__ = {
      ...globalThis.__TEST_MOCKS__,
      ablyRealtimeMock: {
        channels: { get: vi.fn().mockReturnValue(mockChannel) },
        connection: {
          id: "conn-123",
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
      ablyRestMock: {
        channels: { get: vi.fn().mockReturnValue(mockChannel) },
      },
    };
  });

  afterEach(() => {
    // Only delete the mocks we added, not the whole object
    if (globalThis.__TEST_MOCKS__) {
      delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
      delete globalThis.__TEST_MOCKS__.ablyRestMock;
    }
    vi.restoreAllMocks();
  });

  describe("bench publisher", () => {
    describe("help", () => {
      it("should display help with --help flag", async () => {
        const { stdout } = await runCommand(
          ["bench:publisher", "--help"],
          import.meta.url,
        );

        expect(stdout).toContain("Run a publisher benchmark test");
        expect(stdout).toContain("USAGE");
        expect(stdout).toContain("CHANNEL");
      });

      it("should display examples in help", async () => {
        const { stdout } = await runCommand(
          ["bench:publisher", "--help"],
          import.meta.url,
        );

        expect(stdout).toContain("EXAMPLES");
        expect(stdout).toContain("bench publisher");
      });
    });

    describe("flags", () => {
      it("should accept --messages flag", async () => {
        const { stdout } = await runCommand(
          ["bench:publisher", "--help"],
          import.meta.url,
        );

        expect(stdout).toContain("--messages");
        expect(stdout).toContain("-m");
      });

      it("should accept --rate flag", async () => {
        const { stdout } = await runCommand(
          ["bench:publisher", "--help"],
          import.meta.url,
        );

        expect(stdout).toContain("--rate");
        expect(stdout).toContain("-r");
      });

      it("should accept --transport flag", async () => {
        const { stdout } = await runCommand(
          ["bench:publisher", "--help"],
          import.meta.url,
        );

        expect(stdout).toContain("--transport");
        expect(stdout).toContain("rest");
        expect(stdout).toContain("realtime");
      });

      it("should accept --message-size flag", async () => {
        const { stdout } = await runCommand(
          ["bench:publisher", "--help"],
          import.meta.url,
        );

        expect(stdout).toContain("--message-size");
      });

      it("should accept --wait-for-subscribers flag", async () => {
        const { stdout } = await runCommand(
          ["bench:publisher", "--help"],
          import.meta.url,
        );

        expect(stdout).toContain("--wait-for-subscribers");
      });
    });

    describe("argument validation", () => {
      it("should require channel argument", async () => {
        const { error } = await runCommand(
          ["bench:publisher", "--api-key", "app.key:secret"],
          import.meta.url,
        );

        expect(error).toBeDefined();
        expect(error?.message).toMatch(/missing.*channel|required/i);
      });
    });

    describe("publishing functionality", () => {
      it("should publish messages at the specified rate", async () => {
        const { stdout } = await runCommand(
          [
            "bench:publisher",
            "test-channel",
            "--api-key",
            "app.key:secret",
            "--messages",
            "5",
            "--rate",
            "5",
            "--message-size",
            "100",
            "--json",
          ],
          import.meta.url,
        );

        // Should have output (benchmark complete message or JSON output)
        expect(stdout.length).toBeGreaterThan(0);

        // Wait for all messages to be published (5 test messages + 2 control envelopes = 7 calls)
        await vi.waitFor(
          () => {
            expect(mockChannel.publish).toHaveBeenCalledTimes(7);
          },
          { timeout: 5000 },
        );
      });

      it("should enter presence before publishing", async () => {
        await runCommand(
          [
            "bench:publisher",
            "test-channel",
            "--api-key",
            "app.key:secret",
            "--messages",
            "3",
            "--rate",
            "10",
            "--json",
          ],
          import.meta.url,
        );

        expect(mockChannel.presence.enter).toHaveBeenCalled();
      });

      it("should wait for subscribers via presence.get when flag is set", async () => {
        // Mock subscriber already present
        const mockSubscriber = {
          clientId: "subscriber1",
          data: { role: "subscriber" },
        };
        mockChannel.presence.get.mockResolvedValue([mockSubscriber]);

        await runCommand(
          [
            "bench:publisher",
            "test-channel",
            "--api-key",
            "app.key:secret",
            "--messages",
            "2",
            "--rate",
            "10",
            "--wait-for-subscribers",
            "--json",
          ],
          import.meta.url,
        );

        expect(mockChannel.presence.subscribe).toHaveBeenCalledWith(
          "enter",
          expect.any(Function),
        );
        expect(mockChannel.presence.unsubscribe).toHaveBeenCalledWith(
          "enter",
          expect.any(Function),
        );
        expect(mockChannel.presence.get).toHaveBeenCalled();
      });
    });

    it("should wait for subscribers via presence.subscribe when flag is set", async () => {
      // Mock subscriber already present
      const mockSubscriber = {
        clientId: "subscriber1",
        data: { role: "subscriber" },
      };
      mockChannel.presence.subscribe.mockImplementation((event, listener) => {
        setTimeout(() => {
          listener(mockSubscriber);
        }, 1000);
      });

      await runCommand(
        [
          "bench:publisher",
          "test-channel",
          "--api-key",
          "app.key:secret",
          "--messages",
          "2",
          "--rate",
          "10",
          "--wait-for-subscribers",
          "--json",
        ],
        import.meta.url,
      );

      expect(mockChannel.presence.subscribe).toHaveBeenCalledWith(
        "enter",
        expect.any(Function),
      );
      expect(mockChannel.presence.unsubscribe).toHaveBeenCalledWith(
        "enter",
        expect.any(Function),
      );
      expect(mockChannel.presence.get).toHaveBeenCalled();
    });
  });

  describe("bench subscriber", () => {
    describe("help", () => {
      it("should display help with --help flag", async () => {
        const { stdout } = await runCommand(
          ["bench:subscriber", "--help"],
          import.meta.url,
        );

        expect(stdout).toContain("Run a subscriber benchmark test");
        expect(stdout).toContain("USAGE");
        expect(stdout).toContain("CHANNEL");
      });

      it("should display examples in help", async () => {
        const { stdout } = await runCommand(
          ["bench:subscriber", "--help"],
          import.meta.url,
        );

        expect(stdout).toContain("EXAMPLES");
        expect(stdout).toContain("bench subscriber");
      });
    });

    describe("flags", () => {
      it("should accept --duration flag", async () => {
        const { stdout } = await runCommand(
          ["bench:subscriber", "--help"],
          import.meta.url,
        );

        expect(stdout).toContain("--duration");
        expect(stdout).toContain("-d");
      });
    });

    describe("argument validation", () => {
      it("should require channel argument", async () => {
        const { error } = await runCommand(
          ["bench:subscriber", "--api-key", "app.key:secret"],
          import.meta.url,
        );

        expect(error).toBeDefined();
        expect(error?.message).toMatch(/missing.*channel|required/i);
      });
    });

    describe("subscription functionality", () => {
      it("should subscribe to channel and enter presence", async () => {
        const { error } = await runCommand(
          ["bench:subscriber", "test-channel", "--api-key", "app.key:secret"],
          import.meta.url,
        );

        // Command should complete without error (uses duration from env var in test mode)
        expect(error).toBeUndefined();

        // Should have subscribed and entered presence
        expect(mockChannel.subscribe).toHaveBeenCalled();
        expect(mockChannel.presence.enter).toHaveBeenCalledWith({
          role: "subscriber",
        });
      });
    });
  });
});
