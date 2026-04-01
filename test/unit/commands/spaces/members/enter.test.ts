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

describe("spaces:members:enter command", () => {
  beforeEach(() => {
    getMockAblyRealtime();
    getMockAblySpaces();
  });

  standardHelpTests("spaces:members:enter", import.meta.url);
  standardArgValidationTests("spaces:members:enter", import.meta.url, {
    requiredArgs: ["test-space"],
  });
  standardFlagTests("spaces:members:enter", import.meta.url, ["--json"]);

  describe("functionality", () => {
    it("should parse --profile JSON and pass to space.enter", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      const profile = { name: "User", status: "active" };

      const { stderr } = await runCommand(
        [
          "spaces:members:enter",
          "test-space",
          "--profile",
          JSON.stringify(profile),
        ],
        import.meta.url,
      );

      expect(space.enter).toHaveBeenCalledWith(profile);
      expect(stderr).toContain("Entered space");
      expect(stderr).toContain("test-space");
    });

    it("should enter without profile when not provided", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      await runCommand(["spaces:members:enter", "test-space"], import.meta.url);

      expect(space.enter).toHaveBeenCalledWith(undefined);
    });

    it("should error on invalid profile JSON", async () => {
      const { error } = await runCommand(
        ["spaces:members:enter", "test-space", "--profile", "not-valid-json"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Invalid profile JSON");
    });
  });

  describe("JSON output", () => {
    it("should output JSON result and hold status", async () => {
      const spacesMock = getMockAblySpaces();
      spacesMock._getSpace("test-space");

      const { stdout } = await runCommand(
        ["spaces:members:enter", "test-space", "--json"],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const result = records.find((r) => r.type === "result");
      expect(result).toBeDefined();
      expect(result!.success).toBe(true);
      expect(result!.member).toBeDefined();
      const member = result!.member as Record<string, unknown>;
      expect(member).toHaveProperty("clientId", "mock-client-id");
      expect(member).toHaveProperty("connectionId", "mock-connection-id");
      expect(member).toHaveProperty("isConnected", true);
      expect(member).toHaveProperty("location", null);
      expect(member).toHaveProperty("lastEvent");

      const status = records.find(
        (r) => r.type === "status" && r.status === "holding",
      );
      expect(status).toBeDefined();
      expect(status!.message).toContain("Holding presence");
    });

    it("should output JSON error on invalid profile", async () => {
      getMockAblySpaces();

      const { stdout } = await runCommand(
        [
          "spaces:members:enter",
          "test-space",
          "--profile",
          "not-valid-json",
          "--json",
        ],
        import.meta.url,
      );

      expect(stdout).toContain('"success"');
      expect(stdout).toContain("false");
      expect(stdout).toContain("Invalid profile JSON");
    });
  });

  describe("error handling", () => {
    it("should handle space enter failure gracefully", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.enter.mockRejectedValue(new Error("Space unavailable"));

      const { error } = await runCommand(
        ["spaces:members:enter", "test-space"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Space unavailable");
    });
  });
});
