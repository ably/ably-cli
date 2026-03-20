import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../helpers/mock-ably-rest.js";
import { parseNdjsonLines } from "../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

describe("spaces:get command", () => {
  beforeEach(() => {
    const mock = getMockAblyRest();
    mock.request.mockClear();
    mock.request.mockResolvedValue({
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
      ],
      statusCode: 200,
    });
  });

  standardHelpTests("spaces:get", import.meta.url);
  standardArgValidationTests("spaces:get", import.meta.url, {
    requiredArgs: ["test-space"],
  });
  standardFlagTests("spaces:get", import.meta.url, ["--json"]);

  describe("functionality", () => {
    it("should fetch space state and display members", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        ["spaces:get", "test-space"],
        import.meta.url,
      );

      expect(mock.request).toHaveBeenCalledOnce();
      const [method, path, version, , body] = mock.request.mock.calls[0];
      expect(method).toBe("get");
      expect(path).toBe(
        `/channels/${encodeURIComponent("test-space::$space")}/presence`,
      );
      expect(version).toBe(2);
      expect(body).toBeNull();

      expect(stdout).toContain("test-space");
      expect(stdout).toContain("user-1");
      expect(stdout).toContain("Client ID:");
      expect(stdout).toContain("Connection ID:");
    });

    it("should output JSON envelope with space and members", async () => {
      const { stdout } = await runCommand(
        ["spaces:get", "test-space", "--json"],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const result = records.find((r) => r.type === "result");
      expect(result).toBeDefined();
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "spaces:get");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("space");
      const space = result!.space as { name: string; members: unknown[] };
      expect(space).toHaveProperty("name", "test-space");
      expect(space.members).toBeInstanceOf(Array);
      expect(space.members[0]).toHaveProperty("clientId", "user-1");
      expect(space.members[0]).toHaveProperty("profileData", { name: "Alice" });
      expect(space.members[0]).toHaveProperty("location", { slide: 1 });
    });

    it("should correctly parse SDK internal data format", async () => {
      const mock = getMockAblyRest();
      mock.request.mockResolvedValue({
        items: [
          {
            clientId: "user-2",
            connectionId: "conn-2",
            action: "present",
            timestamp: 1710000000000,
            data: {
              profileUpdate: { current: { role: "admin" } },
            },
          },
        ],
        statusCode: 200,
      });

      const { stdout } = await runCommand(
        ["spaces:get", "test-space", "--json"],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const result = records.find((r) => r.type === "result");
      const space = result!.space as {
        members: Array<{ profileData: unknown; location: unknown }>;
      };
      expect(space.members[0].profileData).toEqual({ role: "admin" });
      expect(space.members[0].location).toBeNull();
    });

    it("should fail when space has no members (empty presence)", async () => {
      const mock = getMockAblyRest();
      mock.request.mockResolvedValue({ items: [], statusCode: 200 });

      const { error } = await runCommand(
        ["spaces:get", "test-space"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toContain("doesn't have any members");
    });

    it("should mark leave/absent members as not connected", async () => {
      const mock = getMockAblyRest();
      mock.request.mockResolvedValue({
        items: [
          {
            clientId: "user-1",
            connectionId: "conn-1",
            action: "leave",
            timestamp: 1710000000000,
            data: {},
          },
        ],
        statusCode: 200,
      });

      const { stdout } = await runCommand(
        ["spaces:get", "test-space", "--json"],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const result = records.find((r) => r.type === "result");
      const space = result!.space as {
        members: Array<{ isConnected: boolean }>;
      };
      expect(space.members[0].isConnected).toBe(false);
    });
  });

  describe("error handling", () => {
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
      mock.request.mockResolvedValue({
        items: [],
        statusCode: 500,
      });

      const { error } = await runCommand(
        ["spaces:get", "test-space"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toContain("500");
    });
  });
});
