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

describe("spaces:locks:get command", () => {
  beforeEach(() => {
    getMockAblyRealtime();
    getMockAblySpaces();
  });

  standardHelpTests("spaces:locks:get", import.meta.url);
  standardArgValidationTests("spaces:locks:get", import.meta.url, {
    requiredArgs: ["test-space"],
  });
  standardFlagTests("spaces:locks:get", import.meta.url, ["--json"]);

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

    it("should output JSON envelope with type and command for single lock result", async () => {
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
      const resultRecord = records.find((r) => r.type === "result" && r.lock);
      expect(resultRecord).toBeDefined();
      expect(resultRecord).toHaveProperty("type", "result");
      expect(resultRecord).toHaveProperty("command", "spaces:locks:get");
      expect(resultRecord).toHaveProperty("success", true);
      expect(resultRecord!.lock).toHaveProperty("id", "my-lock");
      expect(resultRecord!.lock).toHaveProperty("status", "locked");
      expect(resultRecord!.lock).toHaveProperty("member");
      expect(resultRecord!.lock).toHaveProperty("attributes", null);
      expect(resultRecord!.lock).toHaveProperty("reason", null);
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
      const resultRecord = records.find((r) => r.type === "result");
      expect(resultRecord).toBeDefined();
      expect(resultRecord!.lock).toBeNull();
    });

    it("should get all locks when no lockId is provided", async () => {
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
        ["spaces:locks:get", "test-space", "--json"],
        import.meta.url,
      );

      expect(space.enter).toHaveBeenCalled();
      expect(space.locks.getAll).toHaveBeenCalled();
      expect(stdout).toContain("locks");
    });

    it("should output JSON envelope with type and command for all locks result", async () => {
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
        ["spaces:locks:get", "test-space", "--json"],
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

    it("should handle no locks found when getting all", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.getAll.mockResolvedValue([]);

      const { stdout } = await runCommand(
        ["spaces:locks:get", "test-space", "--json"],
        import.meta.url,
      );

      expect(stdout).toContain("locks");
    });
  });

  describe("error handling", () => {
    it("should handle single lock get errors gracefully", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.get.mockRejectedValue(new Error("Failed to get lock"));

      const { error } = await runCommand(
        ["spaces:locks:get", "test-space", "my-lock"],
        import.meta.url,
      );
      expect(error).toBeDefined();
    });

    it("should handle get all locks errors gracefully", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.getAll.mockRejectedValue(new Error("Failed to get locks"));

      const { error } = await runCommand(
        ["spaces:locks:get", "test-space"],
        import.meta.url,
      );
      expect(error).toBeDefined();
    });
  });
});
