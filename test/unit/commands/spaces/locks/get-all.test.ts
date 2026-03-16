import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblySpaces } from "../../../../helpers/mock-ably-spaces.js";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";
import { parseNdjsonLines } from "../../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("spaces:locks:get-all command", () => {
  beforeEach(() => {
    // Initialize the mocks
    getMockAblyRealtime();
    getMockAblySpaces();
  });

  standardHelpTests("spaces:locks:get-all", import.meta.url);
  standardArgValidationTests("spaces:locks:get-all", import.meta.url, {
    requiredArgs: ["test-space"],
  });
  standardFlagTests("spaces:locks:get-all", import.meta.url, ["--json"]);

  describe("functionality", () => {
    it("should get all locks from a space", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.getAll.mockResolvedValue([
        {
          id: "lock-1",
          member: {
            clientId: "user-1",
            connectionId: "conn-1",
            isConnected: true,
            profileData: null,
            location: null,
            lastEvent: { name: "enter", timestamp: Date.now() },
          },
          status: "locked",
          timestamp: Date.now(),
          attributes: undefined,
          reason: undefined,
        },
      ]);

      const { stdout } = await runCommand(
        ["spaces:locks:get-all", "test-space", "--json"],
        import.meta.url,
      );

      expect(space.enter).toHaveBeenCalled();
      expect(space.locks.getAll).toHaveBeenCalled();
      expect(stdout).toContain("locks");
    });

    it("should output JSON envelope with type and command for lock results", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.getAll.mockResolvedValue([
        {
          id: "lock-1",
          member: {
            clientId: "user-1",
            connectionId: "conn-1",
            isConnected: true,
            profileData: null,
            location: null,
            lastEvent: { name: "enter", timestamp: Date.now() },
          },
          status: "locked",
          timestamp: Date.now(),
          attributes: undefined,
          reason: undefined,
        },
      ]);

      const { stdout } = await runCommand(
        ["spaces:locks:get-all", "test-space", "--json"],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const resultRecord = records.find(
        (r) => r.type === "result" && Array.isArray(r.locks),
      );
      expect(resultRecord).toBeDefined();
      expect(resultRecord).toHaveProperty("type", "result");
      expect(resultRecord).toHaveProperty("command");
      expect(resultRecord).toHaveProperty("success", true);
      expect(resultRecord!.locks).toBeInstanceOf(Array);
      expect(resultRecord!.locks[0]).toHaveProperty("id", "lock-1");
      expect(resultRecord!.locks[0]).toHaveProperty("member");
      expect(resultRecord!.locks[0].member).toHaveProperty(
        "clientId",
        "user-1",
      );
    });

    it("should handle no locks found", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.getAll.mockResolvedValue([]);

      const { stdout } = await runCommand(
        ["spaces:locks:get-all", "test-space", "--json"],
        import.meta.url,
      );

      expect(stdout).toContain("locks");
    });
  });

  describe("error handling", () => {
    it("should handle errors gracefully", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.getAll.mockRejectedValue(new Error("Failed to get locks"));

      const { error } = await runCommand(
        ["spaces:locks:get-all", "test-space"],
        import.meta.url,
      );
      expect(error).toBeDefined();
    });
  });
});
