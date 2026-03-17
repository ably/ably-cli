import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

describe("spaces:get command", () => {
  const mockPresenceResponse = {
    statusCode: 200,
    items: [
      {
        clientId: "user-1",
        connectionId: "conn-1",
        action: "present",
        timestamp: 1710000000000,
        data: {
          profileUpdate: { current: { name: "Alice" } },
          locationUpdate: { current: { slide: 1 } },
        },
      },
      {
        clientId: "user-2",
        connectionId: "conn-2",
        action: "present",
        timestamp: 1710000001000,
        data: {
          profileUpdate: { current: null },
          locationUpdate: { current: null },
        },
      },
    ],
  };

  beforeEach(() => {
    const mock = getMockAblyRest();
    mock.request.mockClear();
    mock.request.mockResolvedValue(mockPresenceResponse);
  });

  standardHelpTests("spaces:get", import.meta.url);
  standardArgValidationTests("spaces:get", import.meta.url, {
    requiredArgs: ["test-space"],
  });
  standardFlagTests("spaces:get", import.meta.url, ["--json"]);

  describe("functionality", () => {
    it("should fetch space state via REST presence API", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        ["spaces:get", "test-space"],
        import.meta.url,
      );

      expect(mock.request).toHaveBeenCalledOnce();
      const callArgs = mock.request.mock.calls[0];
      expect(callArgs[0]).toBe("get");
      expect(callArgs[1]).toContain("test-space");
      expect(callArgs[1]).toContain("%3A%3A%24space");
      expect(stdout).toContain("test-space");
    });

    it("should output JSON with correct envelope structure", async () => {
      const { stdout } = await runCommand(
        ["spaces:get", "test-space", "--json"],
        import.meta.url,
      );

      const json = JSON.parse(stdout);
      expect(json).toHaveProperty("type", "result");
      expect(json).toHaveProperty("success", true);
      expect(json).toHaveProperty("space");
      expect(json.space).toHaveProperty("name", "test-space");
      expect(json.space).toHaveProperty("members");
      expect(json.space.members).toBeInstanceOf(Array);
      expect(json.space.members.length).toBe(2);
      expect(json.space.members[0]).toHaveProperty("clientId", "user-1");
      expect(json.space.members[0]).toHaveProperty("isConnected", true);
      expect(json.space.members[0]).toHaveProperty("profileData");
      expect(json.space.members[0].profileData).toEqual({ name: "Alice" });
    });

    it("should parse presence data fields correctly", async () => {
      const { stdout } = await runCommand(
        ["spaces:get", "test-space", "--json"],
        import.meta.url,
      );

      const json = JSON.parse(stdout);
      const member = json.space.members[0];
      expect(member.location).toEqual({ slide: 1 });
      expect(member.lastEvent).toEqual({
        name: "present",
        timestamp: 1710000000000,
      });
    });

    it("should display members in human-readable format", async () => {
      const { stdout } = await runCommand(
        ["spaces:get", "test-space"],
        import.meta.url,
      );

      expect(stdout).toContain("Space:");
      expect(stdout).toContain("test-space");
      expect(stdout).toContain("Members");
      expect(stdout).toContain("Client ID:");
      expect(stdout).toContain("user-1");
      expect(stdout).toContain("Connection ID:");
      expect(stdout).toContain("conn-1");
    });
  });

  describe("error handling", () => {
    it("should error when space has no members (not found)", async () => {
      const mock = getMockAblyRest();
      mock.request.mockResolvedValue({ statusCode: 200, items: [] });

      const { error } = await runCommand(
        ["spaces:get", "test-space"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("not found");
    });

    it("should handle API errors gracefully", async () => {
      const mock = getMockAblyRest();
      mock.request.mockRejectedValue(new Error("API error"));

      const { error } = await runCommand(
        ["spaces:get", "test-space"],
        import.meta.url,
      );
      expect(error).toBeDefined();
    });

    it("should handle non-200 status codes", async () => {
      const mock = getMockAblyRest();
      mock.request.mockResolvedValue({ statusCode: 404, items: [] });

      const { error } = await runCommand(
        ["spaces:get", "test-space"],
        import.meta.url,
      );
      expect(error).toBeDefined();
    });
  });
});
