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
        id: "ann-id-001",
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
      expect(stdout).toContain("ID:");
      expect(stdout).toContain("ann-id-001");
      expect(stdout).toContain("Timestamp:");
      expect(stdout).toContain("Channel:");
      expect(stdout).toContain("Type: reactions:flag.v1");
      expect(stdout).toContain("Action:");
      expect(stdout).toContain("Name:");
      expect(stdout).toContain("thumbsup");
      expect(stdout).toContain("Client ID:");
      expect(stdout).toContain("user-1");
      expect(stdout).toContain("Serial:");
      expect(stdout).toContain("ann-serial-001");
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
          id: "ann-json-001",
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
        (r) =>
          r.type === "event" &&
          (r as Record<string, unknown>).annotation &&
          ((r as Record<string, unknown>).annotation as Record<string, unknown>)
            .channel === "test-channel",
      );
      expect(events.length).toBeGreaterThan(0);
      const record = events[0];
      expect(record).toHaveProperty("type", "event");
      expect(record).toHaveProperty(
        "command",
        "channels:annotations:subscribe",
      );
      expect(record).toHaveProperty("annotation.channel", "test-channel");
      expect(record).toHaveProperty("annotation.id", "ann-json-001");
      expect(record).toHaveProperty("annotation.serial");
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
          id: "ann-type-001",
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
        (r) =>
          r.type === "event" &&
          (r as Record<string, unknown>).annotation &&
          ((r as Record<string, unknown>).annotation as Record<string, unknown>)
            .channel === "test-channel",
      );
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toHaveProperty(
        "annotation.annotationType",
        "reactions:flag.v1",
      );
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
        id: "ann-data-001",
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

      expect(stdout).toContain("Data:");
      expect(stdout).toContain("emoji");
      expect(stdout).toContain("thumbs-up");
    });

    it("should display encoding, messageSerial, and extras when present", async () => {
      const commandPromise = runCommand(
        ["channels:annotations:subscribe", "test-channel"],
        import.meta.url,
      );

      await vi.waitFor(() => {
        expect(mockAnnotationCallback).not.toBeNull();
      });

      mockAnnotationCallback!({
        id: "ann-extras-001",
        action: "annotation.create",
        type: "reactions:flag.v1",
        name: "thumbsup",
        serial: "ann-serial-001",
        messageSerial: "msg-serial-001",
        timestamp: Date.now(),
        encoding: "utf8",
        extras: { headers: { key: "value" } },
      });

      const { stdout } = await commandPromise;

      expect(stdout).toContain("Encoding:");
      expect(stdout).toContain("utf8");
      expect(stdout).toContain("Message Serial:");
      expect(stdout).toContain("msg-serial-001");
      expect(stdout).toContain("Extras:");
      expect(stdout).toContain("headers");
    });

    it("should omit optional fields from JSON when undefined", async () => {
      const records = await captureJsonLogs(async () => {
        const commandPromise = runCommand(
          ["channels:annotations:subscribe", "test-channel", "--json"],
          import.meta.url,
        );

        await vi.waitFor(() => {
          expect(mockAnnotationCallback).not.toBeNull();
        });

        mockAnnotationCallback!({
          id: "ann-minimal-001",
          action: "annotation.create",
          type: "reactions:flag.v1",
          serial: "ann-001",
          messageSerial: "msg-001",
          timestamp: Date.now(),
        });

        await commandPromise;
      });

      const events = records.filter(
        (r) =>
          r.type === "event" &&
          (r as Record<string, unknown>).annotation &&
          ((r as Record<string, unknown>).annotation as Record<string, unknown>)
            .id === "ann-minimal-001",
      );
      expect(events.length).toBeGreaterThan(0);
      const annotation = (events[0] as Record<string, unknown>)
        .annotation as Record<string, unknown>;
      expect(annotation).not.toHaveProperty("name");
      expect(annotation).not.toHaveProperty("clientId");
      expect(annotation).not.toHaveProperty("count");
      expect(annotation).not.toHaveProperty("data");
      expect(annotation).not.toHaveProperty("encoding");
      expect(annotation).not.toHaveProperty("extras");
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
