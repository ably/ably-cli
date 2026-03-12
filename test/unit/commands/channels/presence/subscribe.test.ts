import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("channels:presence:subscribe command", () => {
  let presenceCallback: ((msg: unknown) => void) | null = null;

  beforeEach(() => {
    presenceCallback = null;

    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("test-channel");

    // Configure presence.subscribe to capture the callback
    channel.presence.subscribe.mockImplementation(
      (callback: (msg: unknown) => void) => {
        presenceCallback = callback;
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

  standardHelpTests("channels:presence:subscribe", import.meta.url);
  standardArgValidationTests("channels:presence:subscribe", import.meta.url, {
    requiredArgs: ["test-channel"],
  });
  standardFlagTests("channels:presence:subscribe", import.meta.url, [
    "--json",
    "--duration",
  ]);

  describe("functionality", () => {
    it("should subscribe to presence events on a channel", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-channel");

      const { stdout } = await runCommand(
        ["channels:presence:subscribe", "test-channel"],
        import.meta.url,
      );

      // Should show subscription message
      expect(stdout).toContain("test-channel");
      expect(stdout).toContain("presence");
      // Verify presence.subscribe was called
      expect(channel.presence.subscribe).toHaveBeenCalled();
    });

    it("should receive and display presence events with action, client and data", async () => {
      // Run command
      const commandPromise = runCommand(
        ["channels:presence:subscribe", "test-channel"],
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

      // Should show presence event output with structured fields
      expect(stdout).toContain("test-channel");
      expect(stdout).toContain("ID:");
      expect(stdout).toContain("presence-msg-123");
      expect(stdout).toContain("Timestamp:");
      expect(stdout).toContain("Action: enter");
      expect(stdout).toContain("Channel:");
      expect(stdout).toContain("Client ID:");
      expect(stdout).toContain("other-client");
      expect(stdout).toContain("Connection ID:");
      expect(stdout).toContain("conn-123");
      expect(stdout).toContain("Data:");
      expect(stdout).toContain("online");
    });

    it("should run with --json flag without errors", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-channel");

      const { error } = await runCommand(
        ["channels:presence:subscribe", "test-channel", "--json"],
        import.meta.url,
      );

      // Should not have errors - command runs successfully in JSON mode
      expect(error).toBeUndefined();
      // Verify presence.subscribe was still called
      expect(channel.presence.subscribe).toHaveBeenCalled();
    });

    it("should handle multiple presence events", async () => {
      const commandPromise = runCommand(
        ["channels:presence:subscribe", "test-channel"],
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
    it("should accept --client-id flag", async () => {
      const { error } = await runCommand(
        [
          "channels:presence:subscribe",
          "test-channel",
          "--client-id",
          "my-client",
        ],
        import.meta.url,
      );

      expect(error).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("should handle missing mock client in test mode", async () => {
      if (globalThis.__TEST_MOCKS__) {
        delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
      }

      const { error } = await runCommand(
        ["channels:presence:subscribe", "test-channel"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No mock|client/i);
    });
  });
});
