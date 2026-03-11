import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../helpers/mock-ably-realtime.js";
import { captureJsonLogs } from "../../../helpers/ndjson.js";

describe("channels:subscribe command", () => {
  let mockSubscribeCallback: ((message: unknown) => void) | null = null;

  beforeEach(() => {
    mockSubscribeCallback = null;

    // Get the centralized mock and configure for this test
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("test-channel");

    // Configure subscribe to capture the callback
    channel.subscribe.mockImplementation(
      (callback: (message: unknown) => void) => {
        mockSubscribeCallback = callback;
      },
    );

    // Configure connection.once to immediately call callback for 'connected'
    mock.connection.once.mockImplementation(
      (event: string, callback: () => void) => {
        if (event === "connected") {
          callback();
        }
      },
    );

    // Configure channel.once to immediately call callback for 'attached'
    channel.once.mockImplementation((event: string, callback: () => void) => {
      if (event === "attached") {
        channel.state = "attached";
        callback();
      }
    });
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

  describe("functionality", () => {
    it("should subscribe to a channel and attach", async () => {
      const mock = getMockAblyRealtime();

      const { stdout } = await runCommand(
        ["channels:subscribe", "test-channel"],
        import.meta.url,
      );

      // Should show successful attachment
      expect(stdout).toContain("test-channel");
      // Check we got the channel
      expect(mock.channels.get).toHaveBeenCalledWith(
        "test-channel",
        expect.any(Object),
      );
    });

    it("should receive and display messages with event name and data", async () => {
      // Run command in background-like manner
      const commandPromise = runCommand(
        ["channels:subscribe", "test-channel"],
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
        ["channels:subscribe", "test-channel", "--json"],
        import.meta.url,
      );

      // Should not have thrown an error
      expect(error).toBeUndefined();
      // In JSON mode, the command should still work (no user-friendly messages)
      // Output may be minimal since duration elapses quickly
      expect(stdout).toBeDefined();
    });

    it("should emit JSON envelope with type and command for --json events", async () => {
      const records = await captureJsonLogs(async () => {
        const commandPromise = runCommand(
          ["channels:subscribe", "test-channel", "--json"],
          import.meta.url,
        );

        await vi.waitFor(() => {
          expect(mockSubscribeCallback).not.toBeNull();
        });

        mockSubscribeCallback!({
          name: "greeting",
          data: "hi",
          timestamp: Date.now(),
          id: "msg-envelope-test",
          clientId: "client-1",
          connectionId: "conn-1",
        });

        await commandPromise;
      });
      const events = records.filter(
        (r) => r.type === "event" && r.channel === "test-channel",
      );
      expect(events.length).toBeGreaterThan(0);
      const record = events[0];
      expect(record).toHaveProperty("type", "event");
      expect(record).toHaveProperty("command", "channels:subscribe");
      expect(record).toHaveProperty("channel", "test-channel");
      expect(record).toHaveProperty("event", "greeting");
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
      const mock = getMockAblyRealtime();

      await runCommand(
        ["channels:subscribe", "test-channel", "--rewind", "5"],
        import.meta.url,
      );

      expect(mock.channels.get).toHaveBeenCalledWith(
        "test-channel",
        expect.objectContaining({
          params: expect.objectContaining({ rewind: "5" }),
        }),
      );
    });

    it("should configure channel with delta option", async () => {
      const mock = getMockAblyRealtime();

      await runCommand(
        ["channels:subscribe", "test-channel", "--delta"],
        import.meta.url,
      );

      expect(mock.channels.get).toHaveBeenCalledWith(
        "test-channel",
        expect.objectContaining({
          params: expect.objectContaining({ delta: "vcdiff" }),
        }),
      );
    });
  });

  describe("error handling", () => {
    it("should handle missing mock client in test mode", async () => {
      if (globalThis.__TEST_MOCKS__) {
        delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
      }

      const { error } = await runCommand(
        ["channels:subscribe", "test-channel"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No mock|client/i);
    });
  });
});
