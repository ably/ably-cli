import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblySpaces } from "../../../../helpers/mock-ably-spaces.js";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";
import { parseNdjsonLines } from "../../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("spaces:cursors:set command", () => {
  beforeEach(() => {
    getMockAblyRealtime();
    getMockAblySpaces();
  });

  standardHelpTests("spaces:cursors:set", import.meta.url);
  standardFlagTests("spaces:cursors:set", import.meta.url, ["--json"]);

  describe("argument validation", () => {
    it("should require space argument", async () => {
      const { error } = await runCommand(
        ["spaces:cursors:set"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Missing .* required arg/);
    });

    it("should reject unknown flags", async () => {
      const args = ["spaces:cursors:set", "test-space", "--unknown-flag-xyz"];
      const { error } = await runCommand(args, import.meta.url);
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should error when no position input provided", async () => {
      const { error } = await runCommand(
        ["spaces:cursors:set", "test-space"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Cursor position is required");
    });
  });

  describe("functionality", () => {
    it("should error on invalid --data JSON", async () => {
      const { error } = await runCommand(
        ["spaces:cursors:set", "test-space", "--data", "not-valid-json"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Invalid JSON");
    });

    it("should error when --data missing position.x/y", async () => {
      const { error } = await runCommand(
        [
          "spaces:cursors:set",
          "test-space",
          "--data",
          '{"position":{"x":"not-a-number"}}',
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Invalid cursor position");
    });
  });

  describe("setting cursor position", () => {
    it("should set cursor with --x and --y flags", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      const { stdout } = await runCommand(
        ["spaces:cursors:set", "test-space", "--x", "100", "--y", "200"],
        import.meta.url,
      );

      expect(space.enter).toHaveBeenCalled();
      expect(space.cursors.set).toHaveBeenCalledWith(
        expect.objectContaining({
          position: { x: 100, y: 200 },
        }),
      );
      expect(stdout).toContain("Set cursor");
      expect(stdout).toContain("test-space");
      expect(stdout).toContain("Position X:");
      expect(stdout).toContain("100");
      expect(stdout).toContain("Position Y:");
      expect(stdout).toContain("200");
    });

    it("should set cursor from --data with position object", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      await runCommand(
        [
          "spaces:cursors:set",
          "test-space",
          "--data",
          '{"position":{"x":50,"y":75}}',
        ],
        import.meta.url,
      );

      expect(space.cursors.set).toHaveBeenCalledWith(
        expect.objectContaining({
          position: { x: 50, y: 75 },
        }),
      );
    });

    it("should display hold message in non-simulate mode", async () => {
      const spacesMock = getMockAblySpaces();
      spacesMock._getSpace("test-space");

      const { stdout } = await runCommand(
        ["spaces:cursors:set", "test-space", "--x", "100", "--y", "200"],
        import.meta.url,
      );

      expect(stdout).toContain("Holding cursor.");
      expect(stdout).toContain("Press Ctrl+C to exit.");
    });

    it("should merge --data with --x/--y as additional cursor data", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      await runCommand(
        [
          "spaces:cursors:set",
          "test-space",
          "--x",
          "100",
          "--y",
          "200",
          "--data",
          '{"color":"#ff0000"}',
        ],
        import.meta.url,
      );

      expect(space.cursors.set).toHaveBeenCalledWith(
        expect.objectContaining({
          position: { x: 100, y: 200 },
          data: { color: "#ff0000" },
        }),
      );
    });
  });

  describe("JSON output", () => {
    it("should output JSON result and hold status", async () => {
      const spacesMock = getMockAblySpaces();
      spacesMock._getSpace("test-space");

      const { stdout } = await runCommand(
        [
          "spaces:cursors:set",
          "test-space",
          "--x",
          "100",
          "--y",
          "200",
          "--json",
        ],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const result = records.find((r) => r.type === "result");
      expect(result).toBeDefined();
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "spaces:cursors:set");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("cursor");
      const cursor = result!.cursor as Record<string, unknown>;
      expect(cursor).toHaveProperty("position");
      expect(cursor.position).toEqual({ x: 100, y: 200 });
      expect(cursor).toHaveProperty("clientId");
      expect(cursor).toHaveProperty("connectionId");

      const status = records.find((r) => r.type === "status");
      expect(status).toBeDefined();
      expect(status).toHaveProperty("status", "holding");
      expect(status!.message).toContain("Holding cursor");
    });
  });

  describe("error handling", () => {
    it("should handle cursor set failure gracefully", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");
      space.cursors.set.mockRejectedValue(new Error("Cursor update failed"));

      const { error } = await runCommand(
        ["spaces:cursors:set", "test-space", "--x", "100", "--y", "200"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Cursor update failed");
    });
  });
});
