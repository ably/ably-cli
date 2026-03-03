import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";

describe("status command", () => {
  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe("when Ably services are operational", () => {
    it("should display operational status", async () => {
      nock("https://ably.com")
        .get("/status/up.json")
        .reply(200, { status: true });

      const { stdout } = await runCommand(["status"], import.meta.url);

      expect(stdout).toContain("operational");
      expect(stdout).toContain("No incidents currently reported");
      expect(stdout).toContain("https://status.ably.com");
    });
  });

  describe("when there are incidents", () => {
    it("should display incident detected status", async () => {
      nock("https://ably.com")
        .get("/status/up.json")
        .reply(200, { status: false });

      const { stdout } = await runCommand(["status"], import.meta.url);

      expect(stdout).toContain("Incident detected");
      expect(stdout).toContain("open incidents");
      expect(stdout).toContain("https://status.ably.com");
    });
  });

  describe("error handling", () => {
    it("should handle invalid response from status endpoint", async () => {
      nock("https://ably.com").get("/status/up.json").reply(200, {});

      const { error } = await runCommand(["status"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toContain("status attribute is missing");
    });

    it("should handle network errors", async () => {
      nock("https://ably.com")
        .get("/status/up.json")
        .replyWithError("Network error");

      const { error } = await runCommand(["status"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toContain("Network error");
    });

    it("should handle HTTP 500 errors", async () => {
      nock("https://ably.com")
        .get("/status/up.json")
        .reply(500, { error: "Internal Server Error" });

      const { error } = await runCommand(["status"], import.meta.url);

      expect(error).toBeDefined();
    });
  });

  describe("--open flag", () => {
    it("should indicate browser would be opened when --open flag is used", async () => {
      nock("https://ably.com")
        .get("/status/up.json")
        .reply(200, { status: true });

      const { stdout } = await runCommand(
        ["status", "--open"],
        import.meta.url,
      );

      // In test mode, browser opening is simulated
      expect(stdout).toContain("https://status.ably.com");
    });
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["status", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Check the status of the Ably service");
      expect(stdout).toContain("--open");
      expect(stdout).toContain("USAGE");
    });
  });
});
