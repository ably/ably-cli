import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../helpers/mock-ably-realtime.js";

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

  describe("subscription functionality", () => {
    it("should subscribe to a channel and attach", async () => {
      const mock = getMockAblyRealtime();

      const { stdout } = await runCommand(
        ["channels:subscribe", "test-channel", "--api-key", "app.key:secret"],
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
      const mock = getMockAblyRealtime();

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
        [
          "channels:subscribe",
          "test-channel",
          "--api-key",
          "app.key:secret",
          "--delta",
        ],
        import.meta.url,
      );

      expect(mock.channels.get).toHaveBeenCalledWith(
        "test-channel",
        expect.objectContaining({
          params: expect.objectContaining({ delta: "vcdiff" }),
        }),
      );
    });

    it("should accept --stream flag", async () => {
      const { stdout } = await runCommand(
        ["channels:subscribe", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--stream");
    });
  });

  describe("stream mode", () => {
    it("should display message.create data in stream mode", async () => {
      const commandPromise = runCommand(
        [
          "channels:subscribe",
          "test-channel",
          "--api-key",
          "app.key:secret",
          "--stream",
        ],
        import.meta.url,
      );

      await vi.waitFor(() => {
        expect(mockSubscribeCallback).not.toBeNull();
      });

      mockSubscribeCallback!({
        name: "test-event",
        data: "Hello",
        timestamp: Date.now(),
        id: "msg-1",
        clientId: "client-1",
        connectionId: "conn-1",
        action: "message.create",
        serial: "serial-001",
      });

      const { stdout } = await commandPromise;

      expect(stdout).toContain("Hello");
      expect(stdout).toContain("test-channel");
      expect(stdout).toContain("1 msg]");
    });

    it("should stream message.append data for the same serial", async () => {
      const commandPromise = runCommand(
        [
          "channels:subscribe",
          "test-channel",
          "--api-key",
          "app.key:secret",
          "--stream",
        ],
        import.meta.url,
      );

      await vi.waitFor(() => {
        expect(mockSubscribeCallback).not.toBeNull();
      });

      mockSubscribeCallback!({
        name: "test-event",
        data: "Hello",
        timestamp: Date.now(),
        id: "msg-1",
        clientId: "client-1",
        connectionId: "conn-1",
        action: "message.create",
        serial: "serial-001",
      });

      mockSubscribeCallback!({
        name: "test-event",
        data: " World",
        timestamp: Date.now(),
        id: "msg-2",
        clientId: "client-1",
        connectionId: "conn-1",
        action: "message.append",
        serial: "serial-001",
      });

      const { stdout } = await commandPromise;

      // In non-TTY test mode, each token is logged on its own line
      expect(stdout).toContain("Hello");
      expect(stdout).toContain(" World");
      expect(stdout).toContain("2 msgs]");
    });

    it("should include action and serial in JSON output with --stream", async () => {
      const commandPromise = runCommand(
        [
          "channels:subscribe",
          "test-channel",
          "--api-key",
          "app.key:secret",
          "--stream",
          "--json",
        ],
        import.meta.url,
      );

      await vi.waitFor(() => {
        expect(mockSubscribeCallback).not.toBeNull();
      });

      mockSubscribeCallback!({
        name: "test-event",
        data: "Hello",
        timestamp: Date.now(),
        id: "msg-1",
        clientId: "client-1",
        connectionId: "conn-1",
        action: "message.create",
        serial: "serial-001",
      });

      mockSubscribeCallback!({
        name: "test-event",
        data: " World",
        timestamp: Date.now(),
        id: "msg-2",
        clientId: "client-1",
        connectionId: "conn-1",
        action: "message.append",
        serial: "serial-001",
      });

      const { stdout } = await commandPromise;

      expect(stdout).toContain("message.create");
      expect(stdout).toContain("message.append");
      expect(stdout).toContain("serial-001");
    });

    it("should reset accumulation when serial changes", async () => {
      const commandPromise = runCommand(
        [
          "channels:subscribe",
          "test-channel",
          "--api-key",
          "app.key:secret",
          "--stream",
        ],
        import.meta.url,
      );

      await vi.waitFor(() => {
        expect(mockSubscribeCallback).not.toBeNull();
      });

      mockSubscribeCallback!({
        name: "event",
        data: "First",
        timestamp: Date.now(),
        id: "msg-1",
        clientId: "c1",
        connectionId: "conn-1",
        action: "message.create",
        serial: "serial-001",
      });

      mockSubscribeCallback!({
        name: "event",
        data: "Second",
        timestamp: Date.now(),
        id: "msg-2",
        clientId: "c1",
        connectionId: "conn-1",
        action: "message.create",
        serial: "serial-002",
      });

      const { stdout } = await commandPromise;

      expect(stdout).toContain("First");
      expect(stdout).toContain("Second");
    });

    it("should display messages without serial normally in stream mode", async () => {
      const commandPromise = runCommand(
        [
          "channels:subscribe",
          "test-channel",
          "--api-key",
          "app.key:secret",
          "--stream",
        ],
        import.meta.url,
      );

      await vi.waitFor(() => {
        expect(mockSubscribeCallback).not.toBeNull();
      });

      mockSubscribeCallback!({
        name: "test-event",
        data: "plain message",
        timestamp: Date.now(),
        id: "msg-1",
        clientId: "client-1",
        connectionId: "conn-1",
      });

      const { stdout } = await commandPromise;

      expect(stdout).toContain("plain message");
      expect(stdout).toContain("Event: test-event");
    });
  });
});
