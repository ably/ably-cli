import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";

describe("LogsConnectionSubscribe", function () {
  beforeEach(function () {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("[meta]connection.lifecycle");

    // Configure connection.on to simulate connection state changes
    mock.connection.on.mockImplementation(
      (event: string, callback: () => void) => {
        if (event === "connected") {
          setTimeout(() => {
            mock.connection.state = "connected";
            callback();
          }, 10);
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

  it("should subscribe to [meta]connection.lifecycle channel", async function () {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("[meta]connection.lifecycle");

    // Emit SIGINT to stop the command

    const { stdout } = await runCommand(
      ["logs:connection:subscribe"],
      import.meta.url,
    );

    expect(mock.channels.get).toHaveBeenCalledWith(
      "[meta]connection.lifecycle",
    );
    expect(channel.subscribe).toHaveBeenCalled();
    expect(stdout).toContain("Subscribing");
  });

  it("should handle log message reception", async function () {
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

    // Stop the command after message is received

    const { stdout } = await runCommand(
      ["logs:connection:subscribe"],
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
      ["logs:connection:subscribe", "--json"],
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
      ["logs:connection:subscribe"],
      import.meta.url,
    );

    expect(channel.subscribe).toHaveBeenCalled();
    expect(stdout).toContain("connection.connected");
  });

  it("should handle connection failures", async function () {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("[meta]connection.lifecycle");

    // Capture the subscription callback
    let messageCallback: ((message: unknown) => void) | null = null;
    channel.subscribe.mockImplementation(
      (callback: (message: unknown) => void) => {
        messageCallback = callback;
      },
    );

    // Simulate receiving a connection failure event
    setTimeout(() => {
      if (messageCallback) {
        messageCallback({
          name: "connection.failed",
          data: {
            connectionId: "test-connection-789",
            reason: "Network error",
          },
          timestamp: Date.now(),
          clientId: "test-client",
          connectionId: "test-connection-789",
          id: "msg-failed",
        });
      }
    }, 50);

    const { stdout } = await runCommand(
      ["logs:connection:subscribe"],
      import.meta.url,
    );

    expect(channel.subscribe).toHaveBeenCalled();
    expect(stdout).toContain("connection.failed");
  });

  it("should handle missing mock client in test mode", async function () {
    // Clear the realtime mock
    if (globalThis.__TEST_MOCKS__) {
      delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
    }

    const { error } = await runCommand(
      ["logs:connection:subscribe"],
      import.meta.url,
    );

    expect(error).toBeDefined();
    expect(error?.message).toMatch(/No mock|client/i);
  });
});
