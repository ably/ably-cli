import { describe, it, expect } from "vitest";
import { runCommand } from "@oclif/test";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

describe("test:wait command", () => {
  standardHelpTests("test:wait", import.meta.url);
  standardArgValidationTests("test:wait", import.meta.url);

  describe("functionality", () => {
    it("should wait for the specified duration and complete", async () => {
      const { stdout } = await runCommand(
        ["test:wait", "--duration", "1"],
        import.meta.url,
      );

      expect(stdout).toContain("Waiting for 1 seconds");
      expect(stdout).toContain("Wait completed successfully");
    }, 5000);

    it("should accept -d as alias for --duration", async () => {
      const { stdout } = await runCommand(
        ["test:wait", "-d", "1"],
        import.meta.url,
      );

      expect(stdout).toContain("Waiting for 1 seconds");
    }, 5000);
  });

  standardFlagTests("test:wait", import.meta.url, ["--duration", "-d"]);

  describe("error handling", () => {
    it("should require --duration flag", async () => {
      const { error } = await runCommand(["test:wait"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Missing required flag.*duration/i);
    });
  });
});
