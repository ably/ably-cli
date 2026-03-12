import { describe, it, expect } from "vitest";
import { runCommand } from "@oclif/test";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../helpers/standard-tests.js";

describe("login command", () => {
  standardHelpTests("login", import.meta.url);
  standardArgValidationTests("login", import.meta.url);

  describe("functionality", () => {
    // The login command delegates to accounts:login which is interactive.
    // We test that the command exists and shows proper help.
    it("should be recognized as a valid command", async () => {
      const { stdout } = await runCommand(["login", "--help"], import.meta.url);

      expect(stdout).toBeDefined();
      expect(stdout).toContain("Log in to your Ably account");
    });
  });

  standardFlagTests("login", import.meta.url, ["--alias"]);

  describe("error handling", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["login", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });
});
