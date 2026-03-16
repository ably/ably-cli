import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblySpaces } from "../../../../helpers/mock-ably-spaces.js";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";
import { parseNdjsonLines } from "../../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("spaces:locks:get command", () => {
  beforeEach(() => {
    // Initialize the mocks
    getMockAblyRealtime();
    getMockAblySpaces();
  });

  standardHelpTests("spaces:locks:get", import.meta.url);
  standardFlagTests("spaces:locks:get", import.meta.url, ["--json"]);

  describe("argument validation", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["spaces:locks:get", "test-space", "my-lock", "--unknown-flag-xyz"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should require space argument", async () => {
      const { error } = await runCommand(["spaces:locks:get"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Missing .* required arg/);
    });

    it("should require lockId argument", async () => {
      const { error } = await runCommand(
        ["spaces:locks:get", "test-space"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Missing .* required arg/);
    });
  });

  describe("functionality", () => {
    it("should get a specific lock by ID", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.get.mockResolvedValue({
        id: "my-lock",
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
      });

      const { stdout } = await runCommand(
        ["spaces:locks:get", "test-space", "my-lock", "--json"],
        import.meta.url,
      );

      expect(space.enter).toHaveBeenCalled();
      expect(space.locks.get).toHaveBeenCalledWith("my-lock");
      expect(stdout).toContain("my-lock");
    });

    it("should output JSON envelope with type and command for lock result", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.get.mockResolvedValue({
        id: "my-lock",
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
      });

      const { stdout } = await runCommand(
        ["spaces:locks:get", "test-space", "my-lock", "--json"],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const resultRecord = records.find(
        (r) => r.type === "result" && Array.isArray(r.locks),
      );
      expect(resultRecord).toBeDefined();
      expect(resultRecord).toHaveProperty("type", "result");
      expect(resultRecord).toHaveProperty("command", "spaces:locks:get");
      expect(resultRecord).toHaveProperty("success", true);
      expect(resultRecord!.locks).toHaveLength(1);
      expect(resultRecord!.locks[0]).toHaveProperty("id", "my-lock");
      expect(resultRecord!.locks[0]).toHaveProperty("status", "locked");
      expect(resultRecord!.locks[0]).toHaveProperty("member");
      expect(resultRecord!.locks[0]).toHaveProperty("attributes", null);
      expect(resultRecord!.locks[0]).toHaveProperty("reason", null);
    });

    it("should handle lock not found", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.get.mockResolvedValue(null);

      const { stdout } = await runCommand(
        ["spaces:locks:get", "test-space", "nonexistent-lock", "--json"],
        import.meta.url,
      );

      expect(space.locks.get).toHaveBeenCalledWith("nonexistent-lock");
      const records = parseNdjsonLines(stdout);
      const resultRecord = records.find(
        (r) => r.type === "result" && Array.isArray(r.locks),
      );
      expect(resultRecord).toBeDefined();
      expect(resultRecord!.locks).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("should handle errors gracefully", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.get.mockRejectedValue(new Error("Failed to get lock"));

      const { error } = await runCommand(
        ["spaces:locks:get", "test-space", "my-lock"],
        import.meta.url,
      );
      expect(error).toBeDefined();
    });
  });
});
