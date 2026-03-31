import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import {
  getMockAblyRest,
  createMockPaginatedResult,
} from "../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

function createMockChatChannelItems() {
  return [
    {
      channelId: "room1::$chat::$chatMessages",
      status: {
        occupancy: {
          metrics: { connections: 5, publishers: 2, subscribers: 3 },
        },
      },
    },
    {
      channelId: "room1::$chat::$chatMessages::$reactions",
      status: {
        occupancy: { metrics: { connections: 5 } },
      },
    },
    {
      channelId: "room1::$chat::$typingIndicators",
      status: {
        occupancy: { metrics: { connections: 3 } },
      },
    },
    {
      channelId: "room2::$chat::$chatMessages",
      status: {
        occupancy: {
          metrics: { connections: 2, publishers: 1, subscribers: 0 },
        },
      },
    },
    {
      channelId: "regular-channel",
      status: {
        occupancy: { metrics: { connections: 1 } },
      },
    },
  ];
}

describe("rooms:list command", () => {
  standardHelpTests("rooms:list", import.meta.url);
  standardArgValidationTests("rooms:list", import.meta.url);
  standardFlagTests("rooms:list", import.meta.url, [
    "--json",
    "--limit",
    "--prefix",
  ]);

  beforeEach(() => {
    const mock = getMockAblyRest();
    mock.request.mockResolvedValue({
      ...createMockPaginatedResult(createMockChatChannelItems()),
      statusCode: 200,
    });
  });

  it("should filter to ::$chat channels only", async () => {
    const { stdout } = await runCommand(["rooms:list"], import.meta.url);

    expect(stdout).toContain("room1");
    expect(stdout).toContain("room2");
    expect(stdout).not.toContain("regular-channel");
  });

  it("should deduplicate rooms from sub-channels", async () => {
    const { stdout } = await runCommand(["rooms:list"], import.meta.url);

    // room1 has 3 sub-channels but should appear only once in the count
    expect(stdout).toContain("2");
    expect(stdout).toContain("active chat rooms");
  });

  it("should extract room name from channel ID", async () => {
    const { stdout } = await runCommand(["rooms:list"], import.meta.url);

    // Should show "room1" not the full channel ID
    expect(stdout).toContain("room1");
    expect(stdout).not.toContain("::$chat::$chatMessages");
  });

  it("should truncate to --limit", async () => {
    const { stdout } = await runCommand(
      ["rooms:list", "--limit", "1"],
      import.meta.url,
    );

    expect(stdout).toContain("room1");
    expect(stdout).not.toContain("room2");
  });

  it("should pass prefix to API", async () => {
    const mock = getMockAblyRest();

    await runCommand(["rooms:list", "--prefix", "room1"], import.meta.url);

    expect(mock.request).toHaveBeenCalledOnce();
    expect(mock.request.mock.calls[0][3]).toHaveProperty("prefix", "room1");
  });

  it("should show 'No active chat rooms' on empty response", async () => {
    const mock = getMockAblyRest();
    mock.request.mockResolvedValue({
      ...createMockPaginatedResult([]),
      statusCode: 200,
    });

    const { stdout } = await runCommand(["rooms:list"], import.meta.url);

    expect(stdout).toContain("No active chat rooms found");
  });

  it("should output JSON with items array", async () => {
    const { stdout } = await runCommand(
      ["rooms:list", "--json"],
      import.meta.url,
    );

    const json = JSON.parse(stdout);
    expect(json).toHaveProperty("rooms");
    expect(json.rooms).toBeInstanceOf(Array);
    expect(json.rooms.length).toBe(2);
    expect(json.rooms[0]).toEqual("room1");
    expect(json.rooms[1]).toEqual("room2");
    expect(json).toHaveProperty("total", 2);
    expect(json).toHaveProperty("timestamp");
    expect(json).toHaveProperty("hasMore", false);
  });

  it("should handle non-200 response with error", async () => {
    const mock = getMockAblyRest();
    mock.request.mockResolvedValue({ statusCode: 400, error: "Bad Request" });

    const { error } = await runCommand(["rooms:list"], import.meta.url);

    expect(error).toBeDefined();
    expect(error?.message).toContain("Failed to list rooms");
  });

  describe("functionality", () => {
    it("should list active chat rooms", async () => {
      const { stdout } = await runCommand(["rooms:list"], import.meta.url);

      expect(stdout).toContain("room1");
      expect(stdout).toContain("room2");
      expect(stdout).not.toContain("regular-channel");
      expect(stdout).toContain("active chat rooms");
    });
  });

  describe("error handling", () => {
    it("should handle API request failure gracefully", async () => {
      const mock = getMockAblyRest();
      mock.request.mockRejectedValue(new Error("Network error"));

      const { error } = await runCommand(["rooms:list"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toContain("Network error");
    });
  });
});
