import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import {
  nockControl,
  controlApiCleanup,
} from "../../../helpers/control-api-test-helpers.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
  standardControlApiErrorTests,
} from "../../../helpers/standard-tests.js";

describe("support:ask command", () => {
  afterEach(() => {
    controlApiCleanup();
  });

  standardHelpTests("support:ask", import.meta.url);

  standardArgValidationTests("support:ask", import.meta.url, {
    requiredArgs: ["test-question"],
  });

  describe("functionality", () => {
    it("should ask a question and display the answer", async () => {
      nockControl()
        .post("/v1/help")
        .reply(200, {
          answer: "Ably is a realtime messaging platform.",
          links: [
            {
              title: "Getting Started",
              url: "https://ably.com/docs/getting-started",
            },
          ],
        });

      const { stdout } = await runCommand(
        ["support:ask", '"What is Ably?"'],
        import.meta.url,
      );

      expect(stdout).toContain("Ably is a realtime messaging platform");
    });

    it("should output JSON when --json flag is used", async () => {
      nockControl()
        .post("/v1/help")
        .reply(200, {
          answer: "Ably is a realtime messaging platform.",
          links: [
            {
              title: "Getting Started",
              url: "https://ably.com/docs/getting-started",
            },
          ],
        });

      const { stdout } = await runCommand(
        ["support:ask", '"What is Ably?"', "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "support:ask");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("answer");
      expect(result.answer).toHaveProperty("text");
      expect(result.answer).toHaveProperty("links");
    });

    it("should display helpful links when present", async () => {
      nockControl()
        .post("/v1/help")
        .reply(200, {
          answer: "Here is the answer.",
          links: [
            {
              title: "Ably Docs",
              url: "https://ably.com/docs",
            },
          ],
        });

      const { stdout } = await runCommand(
        ["support:ask", '"How do I publish?"'],
        import.meta.url,
      );

      expect(stdout).toContain("Helpful Links");
      expect(stdout).toContain("Ably Docs");
    });
  });

  standardFlagTests("support:ask", import.meta.url, ["--continue", "--json"]);

  describe("error handling", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["support:ask", "question", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/unknown|Nonexistent flag/i);
    });

    standardControlApiErrorTests({
      commandArgs: ["support:ask", '"What is Ably?"'],
      importMetaUrl: import.meta.url,
      setupNock: (scenario) => {
        const scope = nockControl().post("/v1/help");
        if (scenario === "401") scope.reply(401, { error: "Unauthorized" });
        else if (scenario === "500")
          scope.reply(500, { error: "Internal Server Error" });
        else scope.replyWithError("Network error");
      },
    });
  });
});
