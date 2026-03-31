import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblySpaces } from "../../../../helpers/mock-ably-spaces.js";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";
import { parseNdjsonLines } from "../../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("spaces:locations:set command", () => {
  beforeEach(() => {
    getMockAblyRealtime();
    getMockAblySpaces();
  });

  standardHelpTests("spaces:locations:set", import.meta.url);
  standardFlagTests("spaces:locations:set", import.meta.url, ["--json"]);

  describe("argument validation", () => {
    it("should require space argument", async () => {
      const { error } = await runCommand(
        ["spaces:locations:set"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Missing .* required arg/);
    });

    it("should reject unknown flags", async () => {
      const args = [
        "spaces:locations:set",
        "test-space",
        "--location",
        '{"x":1}',
        "--unknown-flag-xyz",
      ];
      const { error } = await runCommand(args, import.meta.url);
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should require --location flag", async () => {
      const { error } = await runCommand(
        ["spaces:locations:set", "test-space"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(
        /--location.*required|Missing required flag/i,
      );
    });
  });

  describe("functionality", () => {
    it("should error on invalid --location JSON", async () => {
      const { error } = await runCommand(
        ["spaces:locations:set", "test-space", "--location", "not-valid-json"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Invalid location JSON");
    });
  });

  describe("setting location", () => {
    it("should parse location JSON and set in space", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      const location = { x: 10, y: 20, sectionId: "main" };

      const { stdout } = await runCommand(
        [
          "spaces:locations:set",
          "test-space",
          "--location",
          JSON.stringify(location),
        ],
        import.meta.url,
      );

      expect(space.enter).toHaveBeenCalled();
      expect(space.locations.set).toHaveBeenCalledWith(location);
      expect(stdout).toContain("Location set");
      expect(stdout).toContain("test-space");
    });

    it("should display hold message", async () => {
      const spacesMock = getMockAblySpaces();
      spacesMock._getSpace("test-space");

      const { stdout } = await runCommand(
        ["spaces:locations:set", "test-space", "--location", '{"x":1}'],
        import.meta.url,
      );

      expect(stdout).toContain("Holding location.");
      expect(stdout).toContain("Press Ctrl+C to exit.");
    });
  });

  describe("JSON output", () => {
    it("should output JSON result and hold status", async () => {
      const spacesMock = getMockAblySpaces();
      spacesMock._getSpace("test-space");

      const location = { x: 10, y: 20 };

      const { stdout } = await runCommand(
        [
          "spaces:locations:set",
          "test-space",
          "--location",
          JSON.stringify(location),
          "--json",
        ],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const result = records.find((r) => r.type === "result");
      expect(result).toBeDefined();
      expect(result!.success).toBe(true);
      expect(result!.location).toEqual(location);

      const status = records.find((r) => r.type === "status");
      expect(status).toBeDefined();
      expect(status).toHaveProperty("status", "holding");
      expect(status!.message).toContain("Holding location");
    });

    it("should output JSON error on invalid location", async () => {
      const { stdout, error } = await runCommand(
        [
          "spaces:locations:set",
          "test-space",
          "--location",
          "not-valid-json",
          "--json",
        ],
        import.meta.url,
      );

      // fail calls exit(1) which throws in test mode
      expect(error).toBeDefined();

      const records = parseNdjsonLines(stdout);
      const errorRecord = records.find((r) => r.type === "error");
      expect(errorRecord).toBeDefined();
      expect(errorRecord!.success).toBe(false);
      expect((errorRecord!.error as Record<string, unknown>).message).toContain(
        "Invalid location JSON",
      );
    });
  });

  describe("error handling", () => {
    it("should handle location set failure gracefully", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.locations.set.mockRejectedValue(
        new Error("Location service error"),
      );

      const { error } = await runCommand(
        ["spaces:locations:set", "test-space", "--location", '{"x":10,"y":20}'],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Location service error");
    });
  });
});
