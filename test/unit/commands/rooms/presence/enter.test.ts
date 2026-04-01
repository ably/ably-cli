import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../../helpers/mock-ably-chat.js";
import { captureJsonLogs } from "../../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("rooms:presence:enter command", () => {
  beforeEach(() => {
    getMockAblyChat();
  });

  standardHelpTests("rooms:presence:enter", import.meta.url);
  standardArgValidationTests("rooms:presence:enter", import.meta.url, {
    requiredArgs: ["test-room"],
  });
  standardFlagTests("rooms:presence:enter", import.meta.url, [
    "--json",
    "--data",
    "--show-others",
  ]);

  describe("functionality", () => {
    it("should enter presence in room", async () => {
      const mock = getMockAblyChat();
      const room = mock.rooms._getRoom("test-room");

      await runCommand(["rooms:presence:enter", "test-room"], import.meta.url);

      expect(mock.rooms.get).toHaveBeenCalledWith("test-room");
      expect(room.attach).toHaveBeenCalled();
      expect(room.presence.enter).toHaveBeenCalled();
    });

    it("should show progress message", async () => {
      const { stderr } = await runCommand(
        ["rooms:presence:enter", "test-room"],
        import.meta.url,
      );

      expect(stderr).toContain("Entering presence in room");
      expect(stderr).toContain("test-room");
    });

    it("should pass parsed --data to presence.enter", async () => {
      const mock = getMockAblyChat();
      const room = mock.rooms._getRoom("test-room");

      await runCommand(
        ["rooms:presence:enter", "test-room", "--data", '{"status":"online"}'],
        import.meta.url,
      );

      expect(room.presence.enter).toHaveBeenCalledWith({ status: "online" });
    });

    it("should strip shell quotes from --data", async () => {
      const mock = getMockAblyChat();
      const room = mock.rooms._getRoom("test-room");

      await runCommand(
        [
          "rooms:presence:enter",
          "test-room",
          "--data",
          '\'{"status":"online"}\'',
        ],
        import.meta.url,
      );

      expect(room.presence.enter).toHaveBeenCalledWith({ status: "online" });
    });

    it("should error on invalid --data JSON", async () => {
      const { error } = await runCommand(
        ["rooms:presence:enter", "test-room", "--data", "not-json"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Invalid data JSON");
    });

    it("should subscribe to presence events with --show-others", async () => {
      const mock = getMockAblyChat();
      const room = mock.rooms._getRoom("test-room");

      await runCommand(
        ["rooms:presence:enter", "test-room", "--show-others"],
        import.meta.url,
      );

      expect(room.presence.subscribe).toHaveBeenCalled();
    });

    it("should filter out self events by clientId with --show-others", async () => {
      const mock = getMockAblyChat();
      const room = mock.rooms._getRoom("test-room");

      let presenceCallback: ((event: unknown) => void) | null = null;
      room.presence.subscribe.mockImplementation((callback) => {
        presenceCallback = callback;
        return { unsubscribe: vi.fn() };
      });

      const commandPromise = runCommand(
        ["rooms:presence:enter", "test-room", "--show-others"],
        import.meta.url,
      );

      await vi.waitFor(
        () => {
          expect(room.presence.subscribe).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );

      // Simulate a self event (should be filtered out)
      presenceCallback!({
        type: "enter",
        member: {
          clientId: mock.clientId,
          connectionId: "conn-self",
          data: {},
          updatedAt: new Date(),
        },
      });

      // Simulate another user's event (should be shown)
      presenceCallback!({
        type: "enter",
        member: {
          clientId: "other-user",
          connectionId: "conn-other",
          data: {},
          updatedAt: new Date(),
        },
      });

      const { stdout } = await commandPromise;
      expect(stdout).toContain("other-user");
      // Self events should be filtered from the event stream (Room: ... | Action: ... lines)
      // but the client ID will appear in the "Client ID: mock-client-id" success label
      const eventLines = stdout
        .split("\n")
        .filter((line) => line.includes("| Action:"));
      for (const line of eventLines) {
        expect(line).not.toContain(mock.clientId);
      }
    });

    it("should output JSON result on enter success", async () => {
      const allRecords = await captureJsonLogs(async () => {
        await runCommand(
          ["rooms:presence:enter", "test-room", "--json"],
          import.meta.url,
        );
      });

      const results = allRecords.filter((r) => r.type === "result");
      expect(results.length).toBeGreaterThanOrEqual(1);

      const result = results[0];
      expect(result.presenceMessage).toBeDefined();
      const msg = result.presenceMessage as Record<string, unknown>;
      expect(msg.action).toBe("enter");
      expect(msg.room).toBe("test-room");
      expect(msg.clientId).toBeDefined();
      expect(msg.data).toBeNull();
    });

    it("should emit hold status in JSON mode", async () => {
      const allRecords = await captureJsonLogs(async () => {
        await runCommand(
          ["rooms:presence:enter", "test-room", "--json"],
          import.meta.url,
        );
      });

      const statusRecords = allRecords.filter((r) => r.type === "status");
      expect(statusRecords.length).toBeGreaterThanOrEqual(1);

      const status = statusRecords[0];
      expect(status.status).toBe("holding");
      expect(status.message).toContain("Holding presence");
    });

    it("should output JSON events with --show-others", async () => {
      const mock = getMockAblyChat();
      const room = mock.rooms._getRoom("test-room");

      let presenceCallback: ((event: unknown) => void) | null = null;
      room.presence.subscribe.mockImplementation((callback) => {
        presenceCallback = callback;
        return { unsubscribe: vi.fn() };
      });

      const allRecords = await captureJsonLogs(async () => {
        const commandPromise = runCommand(
          ["rooms:presence:enter", "test-room", "--show-others", "--json"],
          import.meta.url,
        );

        await vi.waitFor(
          () => {
            expect(room.presence.subscribe).toHaveBeenCalled();
          },
          { timeout: 1000 },
        );

        // Simulate a presence event from another user
        if (presenceCallback) {
          presenceCallback({
            type: "enter",
            member: {
              clientId: "other-user",
              connectionId: "conn-other",
              data: { status: "online" },
              updatedAt: new Date(),
            },
          });
        }

        await commandPromise;
      });

      // Find the JSON output with presence event data
      const records = allRecords.filter(
        (r) => r.type === "event" && r.presenceMessage,
      );

      expect(records.length).toBeGreaterThan(0);
      const parsed = records[0];
      expect(parsed).toHaveProperty("command");
      expect(parsed).toHaveProperty("type", "event");
      const msg = parsed.presenceMessage as Record<string, unknown>;
      expect(msg.action).toBe("enter");
      expect(msg.clientId).toBe("other-user");
      expect(msg.connectionId).toBe("conn-other");
    });
  });

  describe("error handling", () => {
    it("should handle presence enter failure gracefully", async () => {
      const mock = getMockAblyChat();
      const room = mock.rooms._getRoom("test-room");
      room.presence.enter.mockRejectedValue(new Error("Service unavailable"));

      const { error } = await runCommand(
        ["rooms:presence:enter", "test-room"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Service unavailable");
    });
  });
});
