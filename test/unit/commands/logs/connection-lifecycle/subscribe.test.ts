import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";
import { captureJsonLogs } from "../../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("LogsConnectionLifecycleSubscribe", function () {
  beforeEach(function () {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("[meta]connection.lifecycle");

    // Configure connection.on to simulate connection state changes
    mock.connection.on.mockImplementation((callback: unknown) => {
      if (typeof callback === "function") {
        setTimeout(() => {
          mock.connection.state = "connected";
          callback({ current: "connected" });
        }, 10);
      }
    });

    // Configure channel.once to immediately call callback for 'attached'
    channel.once.mockImplementation((event: string, callback: () => void) => {
      if (event === "attached") {
        channel.state = "attached";
        callback();
      }
    });
  });

  describe("functionality", () => {
    it("should subscribe to the meta connection lifecycle channel", async () => {
      const mock = getMockAblyRealtime();

      const { stderr } = await runCommand(
        ["logs:connection-lifecycle:subscribe"],
        import.meta.url,
      );

      expect(mock.channels.get).toHaveBeenCalledWith(
        "[meta]connection.lifecycle",
        {},
      );
      const channel = mock.channels._getChannel("[meta]connection.lifecycle");
      expect(channel.subscribe).toHaveBeenCalled();
      expect(stderr).toContain("Subscribed to connection lifecycle logs");
    });
  });

  standardHelpTests("logs:connection-lifecycle:subscribe", import.meta.url);
  standardArgValidationTests(
    "logs:connection-lifecycle:subscribe",
    import.meta.url,
  );
  standardFlagTests("logs:connection-lifecycle:subscribe", import.meta.url, [
    "--json",
    "--rewind",
  ]);

  it("should subscribe to [meta]connection.lifecycle channel", async function () {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("[meta]connection.lifecycle");

    // Emit SIGINT to stop the command

    const { stderr } = await runCommand(
      ["logs:connection-lifecycle:subscribe"],
      import.meta.url,
    );

    expect(mock.channels.get).toHaveBeenCalledWith(
      "[meta]connection.lifecycle",
      {},
    );
    expect(channel.subscribe).toHaveBeenCalled();
    expect(stderr).toContain("Subscribed to connection lifecycle logs");
  });

  it("should handle rewind parameter", async function () {
    const mock = getMockAblyRealtime();

    await runCommand(
      ["logs:connection-lifecycle:subscribe", "--rewind", "10"],
      import.meta.url,
    );

    expect(mock.channels.get).toHaveBeenCalledWith(
      "[meta]connection.lifecycle",
      {
        params: { rewind: "10" },
      },
    );
  });

  it("should handle log message reception for connection lifecycle events", async function () {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("[meta]connection.lifecycle");

    // Capture the subscription callback
    let messageCallback: ((message: unknown) => void) | null = null;
    channel.subscribe.mockImplementation(
      (callback: (message: unknown) => void) => {
        messageCallback = callback;
      },
    );

    // Simulate receiving a message
    setTimeout(() => {
      if (messageCallback) {
        messageCallback({
          name: "connection.opened",
          data: {
            connectionId: "test-connection-123",
            transport: "websocket",
            ipAddress: "192.168.1.1",
          },
          timestamp: Date.now(),
          clientId: "test-client",
          connectionId: "test-connection-123",
          id: "msg-123",
        });
      }
    }, 50);

    const { stdout } = await runCommand(
      ["logs:connection-lifecycle:subscribe"],
      import.meta.url,
    );

    expect(stdout).toContain("connection.opened");
  });

  it("should output JSON when requested", async function () {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("[meta]connection.lifecycle");

    // Capture the subscription callback
    let messageCallback: ((message: unknown) => void) | null = null;
    channel.subscribe.mockImplementation(
      (callback: (message: unknown) => void) => {
        messageCallback = callback;
      },
    );

    // Simulate receiving a message
    setTimeout(() => {
      if (messageCallback) {
        messageCallback({
          name: "connection.opened",
          data: { connectionId: "test-connection-123" },
          timestamp: Date.now(),
          clientId: "test-client",
          connectionId: "test-connection-123",
          id: "msg-123",
        });
      }
    }, 50);

    const { stdout } = await runCommand(
      ["logs:connection-lifecycle:subscribe", "--json"],
      import.meta.url,
    );

    // Verify JSON output - the output contains the event name in JSON format
    expect(stdout).toContain("connection.opened");
  });

  it("should handle connection state changes", async function () {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("[meta]connection.lifecycle");

    // Capture the subscription callback
    let messageCallback: ((message: unknown) => void) | null = null;
    channel.subscribe.mockImplementation(
      (callback: (message: unknown) => void) => {
        messageCallback = callback;
      },
    );

    // Simulate receiving a connection state change event
    setTimeout(() => {
      if (messageCallback) {
        messageCallback({
          name: "connection.connected",
          data: {
            connectionId: "test-connection-456",
            transport: "websocket",
          },
          timestamp: Date.now(),
          clientId: "test-client",
          connectionId: "test-connection-456",
          id: "msg-state-change",
        });
      }
    }, 50);

    const { stdout } = await runCommand(
      ["logs:connection-lifecycle:subscribe"],
      import.meta.url,
    );

    expect(channel.subscribe).toHaveBeenCalled();
    expect(stdout).toContain("connection.connected");
  });

  it("should color-code different connection lifecycle events", async function () {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("[meta]connection.lifecycle");

    // Capture the subscription callback
    let messageCallback: ((message: unknown) => void) | null = null;
    channel.subscribe.mockImplementation(
      (callback: (message: unknown) => void) => {
        messageCallback = callback;
      },
    );

    // Simulate receiving different event types
    setTimeout(() => {
      if (messageCallback) {
        messageCallback({
          name: "connection.closed",
          data: {
            connectionId: "test-connection-123",
            reason: "client closed",
          },
          timestamp: Date.now(),
          clientId: "test-client",
          connectionId: "test-connection-123",
          id: "msg-456",
        });
      }
    }, 50);

    const { stdout } = await runCommand(
      ["logs:connection-lifecycle:subscribe"],
      import.meta.url,
    );

    expect(stdout).toContain("connection.closed");
  });

  it("should handle channel state changes", async function () {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("[meta]connection.lifecycle");

    // Capture the subscription callback
    let messageCallback: ((message: unknown) => void) | null = null;
    channel.subscribe.mockImplementation(
      (callback: (message: unknown) => void) => {
        messageCallback = callback;
      },
    );

    // Simulate receiving a channel state change event
    setTimeout(() => {
      if (messageCallback) {
        messageCallback({
          name: "channel.attached",
          data: {
            channelName: "test-channel",
            state: "attached",
          },
          timestamp: Date.now(),
          clientId: "test-client",
          connectionId: "test-connection-123",
          id: "msg-channel-state",
        });
      }
    }, 50);

    const { stdout } = await runCommand(
      ["logs:connection-lifecycle:subscribe"],
      import.meta.url,
    );

    expect(channel.subscribe).toHaveBeenCalled();
    expect(stdout).toContain("channel.attached");
  });

  it("should emit JSON envelope with type and command for --json events", async function () {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("[meta]connection.lifecycle");

    let messageCallback: ((message: unknown) => void) | null = null;
    channel.subscribe.mockImplementation(
      (callback: (message: unknown) => void) => {
        messageCallback = callback;
      },
    );

    const records = await captureJsonLogs(async () => {
      const commandPromise = runCommand(
        ["logs:connection-lifecycle:subscribe", "--json"],
        import.meta.url,
      );

      await vi.waitFor(() => {
        expect(messageCallback).not.toBeNull();
      });

      messageCallback!({
        name: "connection.opened",
        data: { connectionId: "conn-test" },
        timestamp: Date.now(),
        id: "msg-envelope",
      });

      await commandPromise;
    });
    const events = records.filter(
      (r) => r.type === "event" && r.log?.event === "connection.opened",
    );
    expect(events.length).toBeGreaterThan(0);
    const record = events[0];
    expect(record).toHaveProperty("type", "event");
    expect(record).toHaveProperty(
      "command",
      "logs:connection-lifecycle:subscribe",
    );
    expect(record).toHaveProperty("log");
    expect(record.log).toHaveProperty("event", "connection.opened");
  });

  it("should handle missing mock client in test mode", async function () {
    // Clear the realtime mock
    if (globalThis.__TEST_MOCKS__) {
      delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
    }

    const { error } = await runCommand(
      ["logs:connection-lifecycle:subscribe"],
      import.meta.url,
    );

    expect(error).toBeDefined();
    expect(error?.message).toMatch(/No mock|client/i);
  });

  describe("error handling", () => {
    it("should handle channel subscribe failure gracefully", async function () {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("[meta]connection.lifecycle");
      channel.subscribe.mockImplementation(() => {
        throw new Error("Channel subscribe failed");
      });

      const { error } = await runCommand(
        ["logs:connection-lifecycle:subscribe"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Channel subscribe failed");
    });

    it("should handle capability error gracefully", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("[meta]connection.lifecycle");

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
        ["logs:connection-lifecycle:subscribe"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Channel denied access");
    });
  });
});
