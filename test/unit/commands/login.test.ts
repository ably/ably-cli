import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../helpers/standard-tests.js";
import { parseNdjsonLines } from "../../helpers/ndjson.js";

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

    describe("JSON envelope labelling", () => {
      afterEach(() => {
        delete process.env.ABLY_API_KEY;
      });

      it("labels delegated records with this command's id, not 'unknown'", async () => {
        // The delegate is constructed directly rather than dispatched by oclif,
        // so without an inherited id its records fall back to "unknown".
        // --local is used because it completes without network access.
        process.env.ABLY_API_KEY = "localapp.keyid:keysecret";

        const { stdout } = await runCommand(
          ["login", "--local", "--url", "http://localhost:8081", "--json"],
          import.meta.url,
        );

        const records = parseNdjsonLines(stdout);
        const result = records.find((r) => r.type === "result")!;
        const completed = records.find((r) => r.type === "status")!;

        expect(result).toHaveProperty("command", "login");
        expect(completed).toHaveProperty("command", "login");
      });
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
