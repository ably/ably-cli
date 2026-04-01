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

describe("spaces:locks:acquire command", () => {
  beforeEach(() => {
    getMockAblyRealtime();
    getMockAblySpaces();
  });

  standardHelpTests("spaces:locks:acquire", import.meta.url);
  standardArgValidationTests("spaces:locks:acquire", import.meta.url, {
    requiredArgs: ["test-space"],
  });
  standardFlagTests("spaces:locks:acquire", import.meta.url, ["--json"]);

  describe("functionality", () => {
    it("should acquire lock and display details", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.acquire.mockResolvedValue({
        id: "my-lock",
        status: "locked",
        member: {
          clientId: "mock-client-id",
          connectionId: "conn-1",
          isConnected: true,
          profileData: null,
          location: null,
          lastEvent: { name: "enter", timestamp: Date.now() },
        },
        timestamp: Date.now(),
        attributes: undefined,
        reason: undefined,
      });

      const { stderr } = await runCommand(
        ["spaces:locks:acquire", "test-space", "my-lock"],
        import.meta.url,
      );

      expect(space.enter).toHaveBeenCalled();
      expect(space.locks.acquire).toHaveBeenCalledWith("my-lock", undefined);
      expect(stderr).toContain("Lock acquired");
      expect(stderr).toContain("my-lock");
    });

    it("should pass --data JSON to acquisition", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.acquire.mockResolvedValue({
        id: "my-lock",
        status: "locked",
        member: {
          clientId: "mock-client-id",
          connectionId: "conn-1",
          isConnected: true,
          profileData: null,
          location: null,
          lastEvent: { name: "enter", timestamp: Date.now() },
        },
        timestamp: Date.now(),
        attributes: undefined,
        reason: undefined,
      });

      const { stderr } = await runCommand(
        [
          "spaces:locks:acquire",
          "test-space",
          "my-lock",
          "--data",
          '{"type":"editor"}',
        ],
        import.meta.url,
      );

      expect(space.locks.acquire).toHaveBeenCalledWith("my-lock", {
        type: "editor",
      });
      expect(stderr).toContain("Lock acquired");
    });

    it("should error on invalid --data JSON", async () => {
      const { error } = await runCommand(
        ["spaces:locks:acquire", "test-space", "my-lock", "--data", "not-json"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Invalid lock data JSON");
    });

    it("should handle acquisition failure", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.acquire.mockRejectedValue(new Error("Lock already held"));

      const { error } = await runCommand(
        ["spaces:locks:acquire", "test-space", "my-lock"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Lock already held");
    });

    it("should output JSON result and hold status", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.acquire.mockResolvedValue({
        id: "my-lock",
        status: "locked",
        member: {
          clientId: "mock-client-id",
          connectionId: "conn-1",
          isConnected: true,
          profileData: null,
          location: null,
          lastEvent: { name: "enter", timestamp: 1700000000000 },
        },
        timestamp: 1700000000000,
        attributes: undefined,
        reason: undefined,
      });

      const { stdout } = await runCommand(
        ["spaces:locks:acquire", "test-space", "my-lock", "--json"],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const result = records.find((r) => r.type === "result");
      expect(result).toBeDefined();
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("lock");
      const lock = result!.lock as Record<string, unknown>;
      expect(lock).toHaveProperty("id", "my-lock");
      expect(lock).toHaveProperty("status", "locked");
      expect(lock).toHaveProperty("member");
      const member = lock.member as Record<string, unknown>;
      expect(member).toHaveProperty("clientId", "mock-client-id");
      expect(lock).toHaveProperty("attributes", null);
      expect(lock).toHaveProperty("reason", null);

      const status = records.find(
        (r) => r.type === "status" && r.status === "holding",
      );
      expect(status).toBeDefined();
      expect(status!.message).toContain("Holding lock");
    });
  });

  describe("error handling", () => {
    it("should handle space enter failure gracefully", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.enter.mockRejectedValue(new Error("Space connection failed"));

      const { error } = await runCommand(
        ["spaces:locks:acquire", "test-space", "my-lock"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Space connection failed");
    });
  });
});
