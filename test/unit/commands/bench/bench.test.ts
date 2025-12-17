import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../helpers/mock-ably-realtime.js";

describe("bench publisher control envelopes", function () {
  beforeEach(function () {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("test-channel");

    // Configure connection
    mock.connection.id = "conn-123";
    mock.connection.state = "connected";
    mock.connection.once.mockImplementation(
      (event: string, callback: () => void) => {
        if (event === "connected") {
          setTimeout(() => callback(), 5);
        }
      },
    );
    // Set clientId without overwriting other auth properties
    mock.auth.clientId = "test-client-id";

    // Configure channel publish
    channel.publish.mockImplementation(async () => {});

    // Configure presence - return a subscriber to satisfy checkAndWaitForSubscribers
    channel.presence.enter.mockImplementation(async () => {});
    channel.presence.leave.mockImplementation(async () => {});
    channel.presence.get.mockResolvedValue([
      {
        clientId: "subscriber-1",
        connectionId: "conn-subscriber-1",
        data: { role: "subscriber" },
        action: "present",
        timestamp: Date.now(),
      },
    ]);
    channel.presence.unsubscribe.mockImplementation(() => {});
    channel.presence.subscribe.mockImplementation(() => {});
  });

  // This test has a 10s timeout because the publisher command has a built-in 3s delay
  // for waiting on message echoes
  it("should publish start, message and end control envelopes in order", async function () {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("test-channel");

    const publishedPayloads: unknown[] = [];
    channel.publish.mockImplementation(async (_name: string, data: unknown) => {
      publishedPayloads.push(data);
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
        "--message-size",
        "50",
        "--json",
      ],
      import.meta.url,
    );

    // Verify publish was called - command publishes start, messages, and end
    expect(channel.publish).toHaveBeenCalled();

    // First payload should be start control
    expect(publishedPayloads[0]).toHaveProperty("type", "start");

    // There should be at least one message payload with type "message"
    const messagePayload = publishedPayloads.find(
      (p: unknown) => (p as { type?: string }).type === "message",
    );
    expect(messagePayload).not.toBeUndefined();

    // Last payload should be end control
    const lastPayload = publishedPayloads.at(-1);
    expect(lastPayload).toHaveProperty("type", "end");
  }, 15_000); // 15 second timeout
});
