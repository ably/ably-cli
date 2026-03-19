import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../helpers/mock-ably-realtime.js";
import { captureJsonLogs } from "../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

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

  standardHelpTests("channels:subscribe", import.meta.url);
  standardArgValidationTests("channels:subscribe", import.meta.url, {
    requiredArgs: ["test-channel"],
  });
  standardFlagTests("channels:subscribe", import.meta.url, [
    "--rewind",
    "--delta",
    "--cipher-key",
    "--json",
    "--token-streaming",
  ]);

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
        serial: "sub-serial-1",
        version: {
          serial: "ver-serial-1",
          timestamp: Date.now(),
          clientId: "version-client",
        },
        annotations: {
          summary: {
            "reaction:distinct.v1": {
              "👍": { total: 2, clientIds: ["c1", "c2"], clipped: false },
            },
          },
        },
      });

      const { stdout } = await commandPromise;

      // Should have received and displayed the message with channel, event, and data
      expect(stdout).toContain("test-channel");
      expect(stdout).toContain("Name: test-event");
      expect(stdout).toContain("hello world");
      expect(stdout).toContain("Timestamp:");
      expect(stdout).toContain("Channel:");
      expect(stdout).toContain("ID:");
      expect(stdout).toContain("msg-123");
      expect(stdout).toContain("Client ID:");
      expect(stdout).toContain("publisher-client");
      expect(stdout).toContain("Data:");
      expect(stdout).toContain("Version:");
      expect(stdout).toContain("ver-serial-1");
      expect(stdout).toContain("version-client");
      expect(stdout).toContain("Annotations:");
      expect(stdout).toContain("reaction:distinct.v1:");
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
          serial: "envelope-serial-1",
          version: {
            serial: "envelope-ver-serial",
            timestamp: Date.now(),
            clientId: "envelope-ver-client",
          },
          annotations: {
            summary: { "test:annotation": { count: 1 } },
          },
        });

        await commandPromise;
      });
      const events = records.filter(
        (r) =>
          r.type === "event" &&
          (r as Record<string, unknown>).message &&
          ((r as Record<string, unknown>).message as Record<string, unknown>)
            .channel === "test-channel",
      );
      expect(events.length).toBeGreaterThan(0);
      const record = events[0];
      expect(record).toHaveProperty("type", "event");
      expect(record).toHaveProperty("command", "channels:subscribe");
      expect(record).toHaveProperty("message.channel", "test-channel");
      expect(record).toHaveProperty("message.name", "greeting");
      expect(record).toHaveProperty("message.id", "msg-envelope-test");
      expect(record).toHaveProperty("message.serial");
      expect(record).toHaveProperty("message.version");
      expect(record).toHaveProperty("message.annotations");
    });
  });

  describe("flags", () => {
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

  describe("token streaming mode", () => {
    it("should display message.create data in token streaming mode", async () => {
      const commandPromise = runCommand(
        ["channels:subscribe", "test-channel", "--token-streaming"],
        import.meta.url,
      );

      await vi.waitFor(() => {
        expect(mockSubscribeCallback).not.toBeNull();
      });

      mockSubscribeCallback!({
        action: "message.create",
        serial: "serial-001",
        name: "test-event",
        data: "Hello",
        timestamp: Date.now(),
        id: "msg-stream-1",
      });

      const { stdout } = await commandPromise;

      expect(stdout).toContain("test-channel");
      expect(stdout).toContain("token-stream");
      expect(stdout).toContain("Hello");
    });

    it("should stream message.append data for the same serial", async () => {
      const commandPromise = runCommand(
        ["channels:subscribe", "test-channel", "--token-streaming"],
        import.meta.url,
      );

      await vi.waitFor(() => {
        expect(mockSubscribeCallback).not.toBeNull();
      });

      mockSubscribeCallback!({
        action: "message.create",
        serial: "serial-001",
        name: "test-event",
        data: "Hello",
        timestamp: Date.now(),
        id: "msg-stream-1",
      });

      mockSubscribeCallback!({
        action: "message.append",
        serial: "serial-001",
        name: "test-event",
        data: " world",
        timestamp: Date.now(),
        id: "msg-stream-2",
      });

      mockSubscribeCallback!({
        action: "message.append",
        serial: "serial-001",
        name: "test-event",
        data: "!",
        timestamp: Date.now(),
        id: "msg-stream-3",
      });

      const { stdout } = await commandPromise;

      // In non-TTY mode, appends show as "+ chunk" lines
      expect(stdout).toContain("Hello");
      expect(stdout).toContain(" world");
      expect(stdout).toContain("!");
      // Should show append count summary
      expect(stdout).toContain("2 appends");
    });

    it("should reset accumulation when serial changes", async () => {
      const commandPromise = runCommand(
        ["channels:subscribe", "test-channel", "--token-streaming"],
        import.meta.url,
      );

      await vi.waitFor(() => {
        expect(mockSubscribeCallback).not.toBeNull();
      });

      mockSubscribeCallback!({
        action: "message.create",
        serial: "serial-001",
        name: "test-event",
        data: "First",
        timestamp: Date.now(),
        id: "msg-1",
      });

      mockSubscribeCallback!({
        action: "message.create",
        serial: "serial-002",
        name: "test-event",
        data: "Second",
        timestamp: Date.now(),
        id: "msg-2",
      });

      const { stdout } = await commandPromise;

      expect(stdout).toContain("First");
      expect(stdout).toContain("Second");
    });

    it("should display messages without serial normally in token streaming mode", async () => {
      const commandPromise = runCommand(
        ["channels:subscribe", "test-channel", "--token-streaming"],
        import.meta.url,
      );

      await vi.waitFor(() => {
        expect(mockSubscribeCallback).not.toBeNull();
      });

      mockSubscribeCallback!({
        name: "test-event",
        data: "no-serial-message",
        timestamp: Date.now(),
        id: "msg-noserial",
      });

      const { stdout } = await commandPromise;

      // Messages without serial should use normal display
      expect(stdout).toContain("no-serial-message");
      expect(stdout).toContain("Name:");
    });

    it("should accumulate chunks containing spaces correctly", async () => {
      const records = await captureJsonLogs(async () => {
        const commandPromise = runCommand(
          ["channels:subscribe", "test-channel", "--token-streaming", "--json"],
          import.meta.url,
        );

        await vi.waitFor(() => {
          expect(mockSubscribeCallback).not.toBeNull();
        });

        mockSubscribeCallback!({
          action: "message.create",
          serial: "serial-spaces-001",
          name: "test",
          data: "The ",
          timestamp: Date.now(),
          id: "msg-sp-1",
        });

        mockSubscribeCallback!({
          action: "message.append",
          serial: "serial-spaces-001",
          name: "test",
          data: "quick ",
          timestamp: Date.now(),
          id: "msg-sp-2",
        });

        mockSubscribeCallback!({
          action: "message.append",
          serial: "serial-spaces-001",
          name: "test",
          data: "brown fox",
          timestamp: Date.now(),
          id: "msg-sp-3",
        });

        await commandPromise;
      });

      const appendEvents = records.filter(
        (r) =>
          r.type === "event" &&
          (r as Record<string, unknown>).message &&
          ((r as Record<string, unknown>).message as Record<string, unknown>)
            .action === "message.append" &&
          ((r as Record<string, unknown>).message as Record<string, unknown>)
            .serial === "serial-spaces-001",
      );

      // Last append should have the full accumulated text with spaces
      const lastAppend = appendEvents.at(-1) as Record<string, unknown>;
      const msg = lastAppend.message as Record<string, unknown>;
      expect(msg.accumulatedData).toBe("The quick brown fox");
    });

    it("should handle message.update as stream replacement when serial matches", async () => {
      const commandPromise = runCommand(
        ["channels:subscribe", "test-channel", "--token-streaming"],
        import.meta.url,
      );

      await vi.waitFor(() => {
        expect(mockSubscribeCallback).not.toBeNull();
      });

      // First a create, then an update with the same serial (should replace accumulated data)
      mockSubscribeCallback!({
        action: "message.create",
        serial: "serial-upd-001",
        name: "test-event",
        data: "Initial",
        timestamp: Date.now(),
        id: "msg-upd-1",
      });

      mockSubscribeCallback!({
        action: "message.update",
        serial: "serial-upd-001",
        name: "test-event",
        data: "Updated content replaces initial",
        timestamp: Date.now(),
        id: "msg-upd-2",
      });

      const { stdout } = await commandPromise;

      // The update should replace the stream data, not display as normal message
      expect(stdout).toContain("token-stream");
      expect(stdout).toContain("Updated content replaces initial");
      // Should NOT have the normal display "Name:" label since it stayed in stream mode
      expect(stdout).not.toContain("Name:");
    });

    it("should fall through to normal display for message.update with different serial", async () => {
      const commandPromise = runCommand(
        ["channels:subscribe", "test-channel", "--token-streaming"],
        import.meta.url,
      );

      await vi.waitFor(() => {
        expect(mockSubscribeCallback).not.toBeNull();
      });

      // Create with one serial, then update with a different serial
      mockSubscribeCallback!({
        action: "message.create",
        serial: "serial-upd-001",
        name: "test-event",
        data: "Initial",
        timestamp: Date.now(),
        id: "msg-upd-1",
      });

      mockSubscribeCallback!({
        action: "message.update",
        serial: "serial-upd-002",
        name: "test-event",
        data: "Different serial update",
        timestamp: Date.now(),
        id: "msg-upd-3",
      });

      const { stdout } = await commandPromise;

      // Different serial should fall through to normal display with Name: label
      expect(stdout).toContain("Initial");
      expect(stdout).toContain("Different serial update");
      expect(stdout).toContain("Name:");
    });

    it("should fall through to normal display for message.delete during streaming mode", async () => {
      const commandPromise = runCommand(
        ["channels:subscribe", "test-channel", "--token-streaming"],
        import.meta.url,
      );

      await vi.waitFor(() => {
        expect(mockSubscribeCallback).not.toBeNull();
      });

      mockSubscribeCallback!({
        action: "message.delete",
        serial: "serial-del-001",
        name: "test-event",
        data: null,
        timestamp: Date.now(),
        id: "msg-del-1",
      });

      const { stdout } = await commandPromise;

      // Delete should use normal display
      expect(stdout).toContain("Name:");
    });

    it("should show append summary when duration exits the last stream", async () => {
      const commandPromise = runCommand(
        ["channels:subscribe", "test-channel", "--token-streaming"],
        import.meta.url,
      );

      await vi.waitFor(() => {
        expect(mockSubscribeCallback).not.toBeNull();
      });

      // Send create + 2 appends with no subsequent create — the stream stays
      // active until duration exit triggers finalizeAllTokenStreams
      mockSubscribeCallback!({
        action: "message.create",
        serial: "serial-dur-001",
        name: "test-event",
        data: "Hello",
        timestamp: Date.now(),
        id: "msg-dur-1",
      });

      mockSubscribeCallback!({
        action: "message.append",
        serial: "serial-dur-001",
        name: "test-event",
        data: " world",
        timestamp: Date.now(),
        id: "msg-dur-2",
      });

      mockSubscribeCallback!({
        action: "message.append",
        serial: "serial-dur-001",
        name: "test-event",
        data: "!",
        timestamp: Date.now(),
        id: "msg-dur-3",
      });

      const { stdout } = await commandPromise;

      // The finalization on duration exit should show the append summary
      expect(stdout).toContain("2 appends");
    });

    it("should emit correct JSON shape for message.create events", async () => {
      const records = await captureJsonLogs(async () => {
        const commandPromise = runCommand(
          ["channels:subscribe", "test-channel", "--token-streaming", "--json"],
          import.meta.url,
        );

        await vi.waitFor(() => {
          expect(mockSubscribeCallback).not.toBeNull();
        });

        mockSubscribeCallback!({
          action: "message.create",
          serial: "serial-create-json-001",
          name: "greeting",
          data: "hello",
          timestamp: Date.now(),
          id: "msg-create-json-1",
        });

        await commandPromise;
      });

      const createEvents = records.filter(
        (r) =>
          r.type === "event" &&
          (r as Record<string, unknown>).message &&
          ((r as Record<string, unknown>).message as Record<string, unknown>)
            .action === "message.create" &&
          ((r as Record<string, unknown>).message as Record<string, unknown>)
            .serial === "serial-create-json-001",
      );

      expect(createEvents.length).toBe(1);
      const event = createEvents[0] as Record<string, unknown>;
      const msg = event.message as Record<string, unknown>;
      expect(msg).toHaveProperty("action", "message.create");
      expect(msg).toHaveProperty("serial", "serial-create-json-001");
      expect(msg).toHaveProperty("data", "hello");
      expect(msg).toHaveProperty("channel", "test-channel");
      expect(msg).toHaveProperty("name", "greeting");
      expect(msg).toHaveProperty("timestamp");
    });

    it("should track concurrent streams independently", async () => {
      const records = await captureJsonLogs(async () => {
        const commandPromise = runCommand(
          ["channels:subscribe", "test-channel", "--token-streaming", "--json"],
          import.meta.url,
        );

        await vi.waitFor(() => {
          expect(mockSubscribeCallback).not.toBeNull();
        });

        // Start stream A
        mockSubscribeCallback!({
          action: "message.create",
          serial: "serial-A",
          data: "Hello",
          timestamp: Date.now(),
          id: "msg-A-1",
        });

        // Start stream B (interleaved)
        mockSubscribeCallback!({
          action: "message.create",
          serial: "serial-B",
          data: "Bonjour",
          timestamp: Date.now(),
          id: "msg-B-1",
        });

        // Append to stream A
        mockSubscribeCallback!({
          action: "message.append",
          serial: "serial-A",
          data: " World",
          timestamp: Date.now(),
          id: "msg-A-2",
        });

        // Append to stream B
        mockSubscribeCallback!({
          action: "message.append",
          serial: "serial-B",
          data: " le monde",
          timestamp: Date.now(),
          id: "msg-B-2",
        });

        await commandPromise;
      });

      // Find the last append for each serial and verify accumulatedData
      const appendEventsA = records.filter(
        (r) =>
          r.type === "event" &&
          (r as Record<string, unknown>).message &&
          ((r as Record<string, unknown>).message as Record<string, unknown>)
            .action === "message.append" &&
          ((r as Record<string, unknown>).message as Record<string, unknown>)
            .serial === "serial-A",
      );
      const appendEventsB = records.filter(
        (r) =>
          r.type === "event" &&
          (r as Record<string, unknown>).message &&
          ((r as Record<string, unknown>).message as Record<string, unknown>)
            .action === "message.append" &&
          ((r as Record<string, unknown>).message as Record<string, unknown>)
            .serial === "serial-B",
      );

      expect(appendEventsA.length).toBe(1);
      expect(appendEventsB.length).toBe(1);

      const msgA = (appendEventsA[0] as Record<string, unknown>)
        .message as Record<string, unknown>;
      const msgB = (appendEventsB[0] as Record<string, unknown>)
        .message as Record<string, unknown>;

      expect(msgA.accumulatedData).toBe("Hello World");
      expect(msgB.accumulatedData).toBe("Bonjour le monde");
    });

    it("should include action and serial in JSON output with --token-streaming", async () => {
      const records = await captureJsonLogs(async () => {
        const commandPromise = runCommand(
          ["channels:subscribe", "test-channel", "--token-streaming", "--json"],
          import.meta.url,
        );

        await vi.waitFor(() => {
          expect(mockSubscribeCallback).not.toBeNull();
        });

        mockSubscribeCallback!({
          action: "message.create",
          serial: "serial-json-001",
          name: "greeting",
          data: "hi",
          timestamp: Date.now(),
          id: "msg-json-1",
        });

        mockSubscribeCallback!({
          action: "message.append",
          serial: "serial-json-001",
          name: "greeting",
          data: " there",
          timestamp: Date.now(),
          id: "msg-json-2",
        });

        await commandPromise;
      });

      const streamEvents = records.filter(
        (r) =>
          r.type === "event" &&
          (r as Record<string, unknown>).message &&
          ((r as Record<string, unknown>).message as Record<string, unknown>)
            .serial === "serial-json-001",
      );
      expect(streamEvents.length).toBeGreaterThanOrEqual(2);

      const createEvent = streamEvents.find(
        (r) =>
          ((r as Record<string, unknown>).message as Record<string, unknown>)
            .action === "message.create",
      );
      expect(createEvent).toBeDefined();
      expect(createEvent).toHaveProperty("message.data", "hi");

      const appendEvent = streamEvents.find(
        (r) =>
          ((r as Record<string, unknown>).message as Record<string, unknown>)
            .action === "message.append",
      );
      expect(appendEvent).toBeDefined();
      expect(appendEvent).toHaveProperty("message.data", " there");
      expect(appendEvent).toHaveProperty("message.accumulatedData", "hi there");
      expect(appendEvent).toHaveProperty("message.appendCount", 1);
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

    it("should handle capability error gracefully", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-channel");

      channel.subscribe.mockRejectedValue(
        Object.assign(
          new Error("Channel denied access based on given capability"),
          {
            code: 40160,
            statusCode: 401,
            href: "https://help.ably.io/error/40160",
          },
        ),
      );

      const { error } = await runCommand(
        ["channels:subscribe", "test-channel"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Channel denied access");
      expect(error?.message).toContain("capability");
      expect(error?.message).toContain("Ably dashboard");
    });

    it("should include hint in JSON error output for capability errors", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-channel");

      channel.subscribe.mockRejectedValue(
        Object.assign(
          new Error("Channel denied access based on given capability"),
          {
            code: 40160,
            statusCode: 401,
            href: "https://help.ably.io/error/40160",
          },
        ),
      );

      const { error, stdout } = await runCommand(
        ["channels:subscribe", "test-channel", "--json"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      const jsonLines = stdout
        .split("\n")
        .filter((l: string) => l.trim().startsWith("{"));
      const errorLine = jsonLines.find((l: string) =>
        l.includes('"type":"error"'),
      );
      expect(errorLine).toBeDefined();
      const parsed = JSON.parse(errorLine!);
      expect(parsed.type).toBe("error");
      expect(parsed.success).toBe(false);
      expect(parsed.code).toBe(40160);
      expect(parsed.hint).toBeDefined();
      expect(parsed.hint).toContain("Ably dashboard");
    });
  });
});
