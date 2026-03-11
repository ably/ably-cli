import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblySpaces } from "../../../../helpers/mock-ably-spaces.js";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";

describe("spaces:members:enter command", () => {
  beforeEach(() => {
    getMockAblyRealtime();
    getMockAblySpaces();
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["spaces:members:enter", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("USAGE");
    });
  });

  describe("flags", () => {
    it("should accept --json flag", async () => {
      const { stdout } = await runCommand(
        ["spaces:members:enter", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("--json");
    });
  });

  describe("argument validation", () => {
    it("should require space argument", async () => {
      const { error } = await runCommand(
        ["spaces:members:enter"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Missing .* required arg/);
    });

    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["spaces:members:enter", "test-space", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("functionality", () => {
    it("should parse --profile JSON and pass to space.enter", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      const profile = { name: "User", status: "active" };

      const { stdout } = await runCommand(
        [
          "spaces:members:enter",
          "test-space",
          "--profile",
          JSON.stringify(profile),
        ],
        import.meta.url,
      );

      expect(space.enter).toHaveBeenCalledWith(profile);
      expect(stdout).toContain("Entered space");
      expect(stdout).toContain("test-space");
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
      expect(error!.message).toContain("Invalid profile JSON");
    });
  });

  describe("member event handling", () => {
    it("should subscribe to member update events", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      await runCommand(["spaces:members:enter", "test-space"], import.meta.url);

      expect(space.members.subscribe).toHaveBeenCalledWith(
        "update",
        expect.any(Function),
      );
    });
  });

  describe("JSON output", () => {
    it("should output JSON on success", async () => {
      const spacesMock = getMockAblySpaces();
      spacesMock._getSpace("test-space");

      const { stdout } = await runCommand(
        ["spaces:members:enter", "test-space", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result.success).toBe(true);
      expect(result.spaceName).toBe("test-space");
      expect(result.status).toBe("connected");
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
      expect(error!.message).toContain("Space unavailable");
    });
  });
});
