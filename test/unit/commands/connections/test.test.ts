import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../helpers/mock-ably-realtime.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

describe("ConnectionsTest", function () {
  beforeEach(function () {
    // Initialize the Realtime mock
    getMockAblyRealtime();
  });

  it("should display help with --help flag", async function () {
    const { stdout } = await runCommand(
      ["connections:test", "--help"],
      import.meta.url,
    );

    expect(stdout).toContain("Test connection to Ably");
    expect(stdout).toContain("--transport");
  });

  it("should accept transport flag", async function () {
    // The command will fail without proper credentials, but flags should be accepted
    const { error } = await runCommand(
      ["connections:test", "--transport", "ws"],
      import.meta.url,
    );

    // Should either succeed or fail with an auth error, not a flag parsing error
    // Error is undefined when command succeeds, or contains an error message
    expect(error?.message ?? "").not.toContain("Unexpected argument");
  });

  it("should accept JSON output flag", async function () {
    // The command will fail without proper credentials, but flags should be accepted
    const { error } = await runCommand(
      ["connections:test", "--json"],
      import.meta.url,
    );

    // Should either succeed or fail with an auth error, not a flag parsing error
    expect(error?.message ?? "").not.toContain("Unexpected argument");
  });

  it("should validate transport options", async function () {
    const { error } = await runCommand(
      ["connections:test", "--transport", "invalid"],
      import.meta.url,
    );

    // Should fail with invalid option error
    expect(error).toBeDefined();
    expect(error?.message).toContain("Expected --transport");
  });

  it("should have correct transport options", async function () {
    // Test that valid transport options are accepted
    const validTransports = ["ws", "xhr", "all"];

    for (const transport of validTransports) {
      const { error } = await runCommand(
        ["connections:test", "--transport", transport],
        import.meta.url,
      );

      // Should not fail with flag parsing error - check message doesn't contain the error
      expect(error?.message ?? "").not.toContain("Expected --transport");
    }
  });

  describe("functionality", () => {
    it("should output connection test summary", async () => {
      // The command creates Ably.Realtime directly (not via base-command mock),
      // so it will fail to connect with mock credentials, but still outputs a summary.
      const { stdout } = await runCommand(
        ["connections:test", "--transport", "ws"],
        import.meta.url,
      );

      expect(stdout).toContain("Connection Test Summary");
    });
  });

  standardHelpTests("connections:test", import.meta.url);
  standardArgValidationTests("connections:test", import.meta.url);
  standardFlagTests("connections:test", import.meta.url, ["--json"]);

  describe("error handling", () => {
    it("should handle invalid transport option", async () => {
      const { error } = await runCommand(
        ["connections:test", "--transport", "invalid"],
        import.meta.url,
      );
      expect(error).toBeDefined();
    });
  });
});
