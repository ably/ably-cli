import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";
import { captureJsonLogs } from "../../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("channels:annotations:subscribe command", () => {
  let mockAnnotationCallback: ((annotation: unknown) => void) | null = null;

  beforeEach(() => {
    mockAnnotationCallback = null;

    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("test-channel");

    // Configure annotations.subscribe to capture the callback
    channel.annotations.subscribe.mockImplementation(
      async (typeOrCallback: unknown, callback?: unknown) => {
        const cb = (callback ?? typeOrCallback) as (
          annotation: unknown,
        ) => void;
        mockAnnotationCallback = cb;
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

  standardHelpTests("channels:annotations:subscribe", import.meta.url);
  standardArgValidationTests(
    "channels:annotations:subscribe",
    import.meta.url,
    {
      requiredArgs: ["test-channel"],
    },
  );
  standardFlagTests("channels:annotations:subscribe", import.meta.url, [
    "--rewind",
    "--type",
    "--json",
  ]);

  describe("functionality", () => {
    it("should subscribe to annotations on a channel", async () => {
      const mock = getMockAblyRealtime();

      const { stdout } = await runCommand(
        ["channels:annotations:subscribe", "test-channel"],
        import.meta.url,
      );

      expect(stdout).toContain("test-channel");
      expect(mock.channels.get).toHaveBeenCalledWith(
        "test-channel",
        expect.objectContaining({
          modes: ["ANNOTATION_SUBSCRIBE"],
        }),
      );
    });

    it("should receive and display annotations", async () => {
      const commandPromise = runCommand(
        ["channels:annotations:subscribe", "test-channel"],
        import.meta.url,
      );

      await vi.waitFor(() => {
        expect(mockAnnotationCallback).not.toBeNull();
      });

      mockAnnotationCallback!({
        action: "annotation.create",
        type: "reactions:flag.v1",
        name: "thumbsup",
        clientId: "user-1",
        serial: "ann-serial-001",
        messageSerial: "msg-serial-001",
        timestamp: Date.now(),
      });

      const { stdout } = await commandPromise;

      expect(stdout).toContain("test-channel");
      expect(stdout).toContain("reactions:flag.v1");
      expect(stdout).toContain("thumbsup");
    });

    it("should run with --json flag without errors", async () => {
      const { stdout, error } = await runCommand(
        ["channels:annotations:subscribe", "test-channel", "--json"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      expect(stdout).toBeDefined();
    });

    it("should emit JSON envelope for --json events", async () => {
      const records = await captureJsonLogs(async () => {
        const commandPromise = runCommand(
          ["channels:annotations:subscribe", "test-channel", "--json"],
          import.meta.url,
        );

        await vi.waitFor(() => {
          expect(mockAnnotationCallback).not.toBeNull();
        });

        mockAnnotationCallback!({
          action: "annotation.create",
          type: "reactions:flag.v1",
          name: "thumbsup",
          clientId: "user-1",
          serial: "ann-001",
          messageSerial: "msg-001",
          timestamp: Date.now(),
        });

        await commandPromise;
      });

      const events = records.filter(
        (r) => r.type === "event" && r.channel === "test-channel",
      );
      expect(events.length).toBeGreaterThan(0);
      const record = events[0];
      expect(record).toHaveProperty("type", "event");
      expect(record).toHaveProperty(
        "command",
        "channels:annotations:subscribe",
      );
      expect(record).toHaveProperty("channel", "test-channel");
    });

    it("should include annotationType in JSON event envelope", async () => {
      const records = await captureJsonLogs(async () => {
        const commandPromise = runCommand(
          ["channels:annotations:subscribe", "test-channel", "--json"],
          import.meta.url,
        );

        await vi.waitFor(() => {
          expect(mockAnnotationCallback).not.toBeNull();
        });

        mockAnnotationCallback!({
          action: "annotation.create",
          type: "reactions:flag.v1",
          name: "thumbsup",
          clientId: "user-1",
          serial: "ann-001",
          messageSerial: "msg-001",
          timestamp: Date.now(),
        });

        await commandPromise;
      });

      const events = records.filter(
        (r) => r.type === "event" && r.channel === "test-channel",
      );
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toHaveProperty("annotationType", "reactions:flag.v1");
      // "type" key in data would collide with envelope — must use "annotationType"
      expect(events[0].type).toBe("event");
    });

    it("should display annotation data in human-readable output", async () => {
      const commandPromise = runCommand(
        ["channels:annotations:subscribe", "test-channel"],
        import.meta.url,
      );

      await vi.waitFor(() => {
        expect(mockAnnotationCallback).not.toBeNull();
      });

      mockAnnotationCallback!({
        action: "annotation.create",
        type: "reactions:flag.v1",
        name: "thumbsup",
        clientId: "user-1",
        serial: "ann-serial-001",
        messageSerial: "msg-serial-001",
        timestamp: Date.now(),
        data: { emoji: "thumbs-up", custom: true },
      });

      const { stdout } = await commandPromise;

      expect(stdout).toContain("Data");
      expect(stdout).toContain("emoji");
      expect(stdout).toContain("thumbs-up");
    });

    it("should pass --type filter to subscribe", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        [
          "channels:annotations:subscribe",
          "test-channel",
          "--type",
          "reactions:flag.v1",
        ],
        import.meta.url,
      );

      expect(channel.annotations.subscribe).toHaveBeenCalledWith(
        "reactions:flag.v1",
        expect.any(Function),
      );
    });
  });

  describe("error handling", () => {
    it("should handle missing mock client in test mode", async () => {
      if (globalThis.__TEST_MOCKS__) {
        delete globalThis.__TEST_MOCKS__.ablyRealtimeMock;
      }

      const { error } = await runCommand(
        ["channels:annotations:subscribe", "test-channel"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No mock|client/i);
    });
  });
});
