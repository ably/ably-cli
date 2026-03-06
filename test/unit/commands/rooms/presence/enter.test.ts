import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../../helpers/mock-ably-chat.js";

describe("rooms:presence:enter command", () => {
  beforeEach(() => {
    getMockAblyChat();
  });

  it("should enter presence in room", async () => {
    const mock = getMockAblyChat();
    const room = mock.rooms._getRoom("test-room");

    await runCommand(["rooms:presence:enter", "test-room"], import.meta.url);

    expect(mock.rooms.get).toHaveBeenCalledWith("test-room");
    expect(room.attach).toHaveBeenCalled();
    expect(room.presence.enter).toHaveBeenCalled();
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
    const capturedLogs: string[] = [];

    const logSpy = vi.spyOn(console, "log").mockImplementation((msg) => {
      capturedLogs.push(String(msg));
    });

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
    if (presenceCallback) {
      presenceCallback({
        type: "enter",
        member: {
          clientId: mock.clientId,
          data: {},
        },
      });

      // Simulate another user's event (should be shown)
      presenceCallback({
        type: "enter",
        member: {
          clientId: "other-user",
          data: {},
        },
      });
    }

    await commandPromise;
    logSpy.mockRestore();

    const output = capturedLogs.join("\n");
    expect(output).toContain("other-user");
    expect(output).not.toContain(mock.clientId);
  });

  it("should output JSON on enter success", async () => {
    const mock = getMockAblyChat();
    const room = mock.rooms._getRoom("test-room");
    const capturedLogs: string[] = [];

    const logSpy = vi.spyOn(console, "log").mockImplementation((msg) => {
      capturedLogs.push(String(msg));
    });

    let presenceCallback: ((event: unknown) => void) | null = null;
    room.presence.subscribe.mockImplementation((callback) => {
      presenceCallback = callback;
      return { unsubscribe: vi.fn() };
    });

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
          data: { status: "online" },
        },
      });
    }

    await commandPromise;
    logSpy.mockRestore();

    // Find the JSON output with presence data
    const jsonLines = capturedLogs.filter((line) => {
      try {
        const parsed = JSON.parse(line);
        return parsed.type && parsed.member;
      } catch {
        return false;
      }
    });

    expect(jsonLines.length).toBeGreaterThan(0);
    const parsed = JSON.parse(jsonLines[0]);
    expect(parsed).toHaveProperty("success", true);
    expect(parsed).toHaveProperty("type", "enter");
    expect(parsed.member).toHaveProperty("clientId", "other-user");
  });
});
