import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblySpaces } from "../../../helpers/mock-ably-spaces.js";
import { getMockAblyRealtime } from "../../../helpers/mock-ably-realtime.js";
import { parseNdjsonLines } from "../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

describe("spaces:create command", () => {
  beforeEach(() => {
    getMockAblyRealtime();
    getMockAblySpaces();
  });

  standardHelpTests("spaces:create", import.meta.url);
  standardArgValidationTests("spaces:create", import.meta.url, {
    requiredArgs: ["test-space"],
  });
  standardFlagTests("spaces:create", import.meta.url, ["--json"]);

  describe("functionality", () => {
    it("should create space and display success", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      const { stdout } = await runCommand(
        ["spaces:create", "test-space"],
        import.meta.url,
      );

      expect(space.enter).not.toHaveBeenCalled();
      expect(stdout).toContain("created");
      expect(stdout).toContain("test-space");
    });

    it("should output JSON envelope with space name", async () => {
      const { stdout } = await runCommand(
        ["spaces:create", "test-space", "--json"],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const result = records.find((r) => r.type === "result");
      expect(result).toBeDefined();
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "spaces:create");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("space");
      expect(result!.space).toHaveProperty("name", "test-space");
    });

    it("should not enter the space", async () => {
      const spacesMock = getMockAblySpaces();
      const space = spacesMock._getSpace("test-space");

      await runCommand(["spaces:create", "test-space"], import.meta.url);

      expect(space.enter).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle connection errors gracefully", async () => {
      const spacesMock = getMockAblySpaces();
      spacesMock.get.mockRejectedValue(new Error("Connection failed"));

      const { error } = await runCommand(
        ["spaces:create", "test-space"],
        import.meta.url,
      );
      expect(error).toBeDefined();
    });
  });
});
