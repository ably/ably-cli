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
      expect(stdout).toContain("Event: test-event");
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
      expect(record).toHaveProperty("message.event", "greeting");
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
  });
});
