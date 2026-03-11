import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";

describe("support:ask command", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["support:ask", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Ask a question to the Ably AI agent");
      expect(stdout).toContain("USAGE");
    });

    it("should display examples in help", async () => {
      const { stdout } = await runCommand(
        ["support:ask", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("EXAMPLES");
    });

    it("should show question argument in help", async () => {
      const { stdout } = await runCommand(
        ["support:ask", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("QUESTION");
    });
  });

  describe("argument validation", () => {
    it("should require question argument", async () => {
      const { error } = await runCommand(["support:ask"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toContain("Missing 1 required arg");
    });
  });

  describe("functionality", () => {
    beforeEach(() => {
      process.env.ABLY_ACCESS_TOKEN = "fake_access_token";
    });

    afterEach(() => {
      delete process.env.ABLY_ACCESS_TOKEN;
    });

    it("should ask a question and display the answer", async () => {
      nock("https://control.ably.net")
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
      nock("https://control.ably.net")
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
      expect(result).toHaveProperty("links");
    });

    it("should display helpful links when present", async () => {
      nock("https://control.ably.net")
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

  describe("flags", () => {
    it("should accept --continue flag", async () => {
      const { stdout } = await runCommand(
        ["support:ask", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--continue");
    });

    it("should accept --json flag", async () => {
      const { stdout } = await runCommand(
        ["support:ask", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--json");
    });

    it("should accept -h flag for help", async () => {
      const { stdout } = await runCommand(
        ["support:ask", "-h"],
        import.meta.url,
      );

      expect(stdout).toContain("Ask a question to the Ably AI agent");
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      process.env.ABLY_ACCESS_TOKEN = "fake_access_token";
    });

    afterEach(() => {
      delete process.env.ABLY_ACCESS_TOKEN;
    });

    it("should handle API errors gracefully", async () => {
      nock("https://control.ably.net")
        .post("/v1/help")
        .reply(500, { error: "Internal Server Error" });

      const { error } = await runCommand(
        ["support:ask", '"What is Ably?"'],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should handle network errors", async () => {
      nock("https://control.ably.net")
        .post("/v1/help")
        .replyWithError("Network error");

      const { error } = await runCommand(
        ["support:ask", '"What is Ably?"'],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["support:ask", "question", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });
});
