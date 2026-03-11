import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblySpaces } from "../../../../helpers/mock-ably-spaces.js";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";

describe("spaces:locations:set command", () => {
  beforeEach(() => {
    getMockAblyRealtime();
    getMockAblySpaces();
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["spaces:locations:set", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("USAGE");
    });
  });

  describe("flags", () => {
    it("should accept --json flag", async () => {
      const { stdout } = await runCommand(
        ["spaces:locations:set", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("--json");
    });
  });

  describe("argument validation", () => {
    it("should require space argument", async () => {
      const { error } = await runCommand(
        ["spaces:locations:set"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });

    it("should require --location flag", async () => {
      const { error } = await runCommand(
        ["spaces:locations:set", "test-space"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(
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
      expect(error!.message).toContain("Invalid location JSON");
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
  });

  describe("JSON output", () => {
    it("should output JSON on success with --duration 0", async () => {
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
          "--duration",
          "0",
        ],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result.success).toBe(true);
      expect(result.location).toEqual(location);
      expect(result.spaceName).toBe("test-space");
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

      const result = JSON.parse(stdout);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid location JSON");
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
      expect(error!.message).toContain("Location service error");
    });
  });
});
