import { describe, it, expect } from "vitest";
import { runCommand } from "@oclif/test";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../helpers/standard-tests.js";
import { parseJsonOutput } from "../../helpers/ndjson.js";

describe("version command", () => {
  standardHelpTests("version", import.meta.url);
  standardArgValidationTests("version", import.meta.url);

  describe("functionality", () => {
    it("should display version information", async () => {
      const { stdout } = await runCommand(["version"], import.meta.url);

      // Version output should contain platform info and node version
      expect(stdout).toContain(process.platform);
      expect(stdout).toContain(process.version);
    });

    it("should display Public Preview status", async () => {
      const { stdout } = await runCommand(["version"], import.meta.url);

      expect(stdout).toContain("Public Preview");
      expect(stdout).toContain("Version");
    });

    it("should output JSON when --json flag is used", async () => {
      const { stdout } = await runCommand(
        ["version", "--json"],
        import.meta.url,
      );

      const result = parseJsonOutput(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "version");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("version");
      expect(result.version).toHaveProperty("version");
      expect(result.version).toHaveProperty("name");
      expect(result.version).toHaveProperty("arch");
      expect(result.version).toHaveProperty("nodeVersion");
      expect(result.version).toHaveProperty("platform");
    });
  });

  standardFlagTests("version", import.meta.url, ["--json", "--pretty-json"]);

  describe("error handling", () => {
    it("should not error when run without arguments", async () => {
      const { stdout, error } = await runCommand(["version"], import.meta.url);

      expect(error).toBeUndefined();
      expect(stdout).toBeTruthy();
    });
  });
});
