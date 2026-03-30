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
    clientId: "client-1",
    connectionId: "conn-1",
    action: "present",
    data: { status: "online" },
    timestamp: 1710835200000,
    id: "msg-1",
    encoding: "",
  },
  {
    clientId: "client-2",
    connectionId: "conn-2",
    action: "present",
    data: null,
    timestamp: 1710835260000,
    id: "msg-2",
    encoding: "",
  },
];

describe("channels:presence:get command", () => {
  beforeEach(() => {
    const mock = getMockAblyRest();
    const channel = mock.channels._getChannel("test-channel");

    channel.presence.get.mockResolvedValue(
      createMockPaginatedResult(mockPresenceMembers),
    );
  });

  standardHelpTests("channels:presence:get", import.meta.url);
  standardArgValidationTests("channels:presence:get", import.meta.url, {
    requiredArgs: ["test-channel"],
  });
  standardFlagTests("channels:presence:get", import.meta.url, [
    "--limit",
    "--json",
    "--pretty-json",
  ]);

  describe("functionality", () => {
    it("should fetch and display presence members", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      const { stdout } = await runCommand(
        ["channels:presence:get", "test-channel"],
        import.meta.url,
      );

      expect(channel.presence.get).toHaveBeenCalledWith({ limit: 100 });
      expect(stdout).toContain("Fetching presence members");
      expect(stdout).toContain("test-channel");
      expect(stdout).toContain("client-1");
      expect(stdout).toContain("client-2");
      expect(stdout).toContain("2 members");
    });

    it("should handle empty presence set", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");
      channel.presence.get.mockResolvedValue(createMockPaginatedResult([]));

      const { stderr } = await runCommand(
        ["channels:presence:get", "test-channel"],
        import.meta.url,
      );

      expect(stderr).toContain("No members currently present");
    });

    it("should output JSON with presenceMembers array", async () => {
      const { stdout } = await runCommand(
        ["channels:presence:get", "test-channel", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout.trim());
      expect(result.type).toBe("result");
      expect(result.members).toBeDefined();
      expect(result.members).toHaveLength(2);
      expect(result.members[0].clientId).toBe("client-1");
      expect(result.members[0].connectionId).toBe("conn-1");
      expect(result.members[0].action).toBe("present");
      expect(result.members[0].data).toEqual({ status: "online" });
      expect(result.members[1].clientId).toBe("client-2");
      expect(result.members[1].data).toBeNull();
      expect(result.hasMore).toBe(false);
      expect(result.total).toBe(2);
    });

    it("should display member data when present", async () => {
      const { stdout } = await runCommand(
        ["channels:presence:get", "test-channel"],
        import.meta.url,
      );

      expect(stdout).toContain("conn-1");
      expect(stdout).toContain("present");
      expect(stdout).toContain('{"status":"online"}');
    });

    it("should pass limit to presence.get", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        ["channels:presence:get", "test-channel", "--limit", "50"],
        import.meta.url,
      );

      expect(channel.presence.get).toHaveBeenCalledWith({ limit: 50 });
    });

    it("should handle pagination with hasMore", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      // Create a response where hasMore will be true (items >= limit)
      const singleMember = {
        clientId: "client-1",
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
        ["channels:presence:get", "test-channel", "--limit", "1", "--json"],
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
      const channel = mock.channels._getChannel("test-channel");
      channel.presence.get.mockRejectedValue(new Error("API error"));

      const { error } = await runCommand(
        ["channels:presence:get", "test-channel"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should handle channel not found", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("nonexistent-channel");
      channel.presence.get.mockRejectedValue(
        Object.assign(new Error("Channel not found"), {
          code: 40400,
          statusCode: 404,
        }),
      );

      const { error } = await runCommand(
        ["channels:presence:get", "nonexistent-channel"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
