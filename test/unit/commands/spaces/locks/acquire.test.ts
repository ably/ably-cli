import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblySpaces } from "../../../../helpers/mock-ably-spaces.js";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";
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
        member: { clientId: "mock-client-id", connectionId: "conn-1" },
        timestamp: Date.now(),
        reason: undefined,
      });

      const { stdout } = await runCommand(
        ["spaces:locks:acquire", "test-space", "my-lock"],
        import.meta.url,
      );

      expect(space.enter).toHaveBeenCalled();
      expect(space.locks.acquire).toHaveBeenCalledWith("my-lock", undefined);
      expect(stdout).toContain("Lock acquired");
      expect(stdout).toContain("my-lock");
    });

    it("should pass --data JSON to acquisition", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.acquire.mockResolvedValue({
        id: "my-lock",
        status: "locked",
        member: { clientId: "mock-client-id", connectionId: "conn-1" },
        timestamp: Date.now(),
      });

      const { stdout } = await runCommand(
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
      expect(stdout).toContain("Lock acquired");
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

    it("should output JSON on success", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locks.acquire.mockResolvedValue({
        id: "my-lock",
        status: "locked",
        member: { clientId: "mock-client-id", connectionId: "conn-1" },
        timestamp: 1700000000000,
      });

      const { stdout } = await runCommand(
        ["spaces:locks:acquire", "test-space", "my-lock", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("lock");
      expect(result.lock).toHaveProperty("lockId", "my-lock");
      expect(result.lock).toHaveProperty("status", "locked");
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
