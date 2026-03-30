import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import {
  getMockAblyRest,
  createMockPaginatedResult,
} from "../../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

const mockPresenceMembers = [
  {
    clientId: "user-1",
    connectionId: "conn-1",
    action: "present",
    data: { status: "online" },
    timestamp: 1710835200000,
    id: "msg-1",
    encoding: "",
    extras: { role: "admin" },
  },
  {
    clientId: "user-2",
    connectionId: "conn-2",
    action: "present",
    data: null,
    timestamp: 1710835260000,
    id: "msg-2",
    encoding: "",
  },
];

describe("rooms:presence:get command", () => {
  beforeEach(() => {
    const mock = getMockAblyRest();
    // Chat SDK maps room presence to roomName::$chat channel
    const channel = mock.channels._getChannel("test-room::$chat");
    channel.presence.get.mockResolvedValue(
      createMockPaginatedResult(mockPresenceMembers),
    );
  });

  standardHelpTests("rooms:presence:get", import.meta.url);
  standardArgValidationTests("rooms:presence:get", import.meta.url, {
    requiredArgs: ["test-room"],
  });
  standardFlagTests("rooms:presence:get", import.meta.url, [
    "--limit",
    "--json",
    "--pretty-json",
  ]);

  describe("functionality", () => {
    it("should fetch and display presence members", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-room::$chat");

      const { stdout } = await runCommand(
        ["rooms:presence:get", "test-room"],
        import.meta.url,
      );

      expect(channel.presence.get).toHaveBeenCalledWith({ limit: 100 });
      expect(stdout).toContain("Fetching presence members");
      expect(stdout).toContain("test-room");
      expect(stdout).toContain("user-1");
      expect(stdout).toContain("user-2");
      expect(stdout).toContain("2 members");
    });

    it("should use the ::$chat channel name convention", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("my-room::$chat");
      channel.presence.get.mockResolvedValue(
        createMockPaginatedResult(mockPresenceMembers),
      );

      await runCommand(["rooms:presence:get", "my-room"], import.meta.url);

      expect(channel.presence.get).toHaveBeenCalled();
    });

    it("should handle empty presence set", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-room::$chat");
      channel.presence.get.mockResolvedValue(createMockPaginatedResult([]));

      const { stdout } = await runCommand(
        ["rooms:presence:get", "test-room"],
        import.meta.url,
      );

      expect(stdout).toContain("No members currently present");
    });

    it("should output JSON with members array", async () => {
      const { stdout } = await runCommand(
        ["rooms:presence:get", "test-room", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout.trim());
      expect(result.type).toBe("result");
      expect(result.members).toBeDefined();
      expect(result.members).toHaveLength(2);
      expect(result.members[0].clientId).toBe("user-1");
      expect(result.members[0].connectionId).toBe("conn-1");
      expect(result.members[0].action).toBe("present");
      expect(result.members[0].data).toEqual({ status: "online" });
      expect(result.members[0].timestamp).toBeDefined();
      expect(result.members[0].id).toBe("msg-1");
      expect(result.members[1].clientId).toBe("user-2");
      expect(result.members[1].data).toBeNull();
      expect(result.hasMore).toBe(false);
      expect(result.total).toBe(2);
    });

    it("should display member data and action when present", async () => {
      const { stdout } = await runCommand(
        ["rooms:presence:get", "test-room"],
        import.meta.url,
      );

      expect(stdout).toContain("conn-1");
      expect(stdout).toContain('{"status":"online"}');
      expect(stdout).toContain("present");
    });

    it("should pass limit to presence.get", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-room::$chat");

      await runCommand(
        ["rooms:presence:get", "test-room", "--limit", "50"],
        import.meta.url,
      );

      expect(channel.presence.get).toHaveBeenCalledWith({ limit: 50 });
    });

    it("should handle pagination with hasMore", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-room::$chat");

      const singleMember = {
        clientId: "user-1",
        connectionId: "conn-1",
        action: "present" as const,
        data: null,
        timestamp: Date.now(),
        id: "msg-1",
        encoding: "",
      };
      channel.presence.get.mockResolvedValue(
        createMockPaginatedResult([singleMember], [singleMember]),
      );

      const { stdout } = await runCommand(
        ["rooms:presence:get", "test-room", "--limit", "1", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout.trim());
      expect(result.hasMore).toBe(true);
      expect(result.next).toBeDefined();
      expect(result.next.hint).toContain("--limit");
    });
  });

  describe("error handling", () => {
    it("should handle API errors gracefully", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-room::$chat");
      channel.presence.get.mockRejectedValue(new Error("API error"));

      const { error } = await runCommand(
        ["rooms:presence:get", "test-room"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should handle channel not found", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("nonexistent::$chat");
      channel.presence.get.mockRejectedValue(
        Object.assign(new Error("Channel not found"), {
          code: 40400,
          statusCode: 404,
        }),
      );

      const { error } = await runCommand(
        ["rooms:presence:get", "nonexistent"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
