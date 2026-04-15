import { describe, it, expect } from "vitest";
import { runCommand } from "@oclif/test";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("ai-transport:demo:streaming command", () => {
  standardHelpTests("ai-transport:demo:streaming", import.meta.url);
  standardArgValidationTests("ai-transport:demo:streaming", import.meta.url);
  standardFlagTests("ai-transport:demo:streaming", import.meta.url, [
    "--role",
    "--channel",
    "--endpoint",
    "--auth-endpoint",
    "--json",
  ]);

  describe("functionality", () => {
    it("should display demo message with default role", async () => {
      const { stdout } = await runCommand(
        ["ai-transport:demo:streaming"],
        import.meta.url,
      );

      expect(stdout).toContain("Streaming Demo");
      expect(stdout).toContain("Role: both");
    });

    it("should accept role flag", async () => {
      const { stdout } = await runCommand(
        ["ai-transport:demo:streaming", "--role", "client"],
        import.meta.url,
      );

      expect(stdout).toContain("Role: client");
    });

    it("should accept channel flag", async () => {
      const { stdout } = await runCommand(
        ["ai-transport:demo:streaming", "--channel", "test-channel"],
        import.meta.url,
      );

      expect(stdout).toContain("Channel: test-channel");
    });
  });

  describe("flags", () => {
    it("should reject --endpoint without --role client", async () => {
      const { error } = await runCommand(
        ["ai-transport:demo:streaming", "--endpoint", "http://localhost:3000"],
        import.meta.url,
      );

      expect(error?.message).toContain(
        "--endpoint can only be used with --role client",
      );
    });

    it("should reject --auth-endpoint without --role client", async () => {
      const { error } = await runCommand(
        [
          "ai-transport:demo:streaming",
          "--auth-endpoint",
          "http://localhost:3000/auth",
        ],
        import.meta.url,
      );

      expect(error?.message).toContain(
        "--auth-endpoint can only be used with --role client",
      );
    });

    it("should accept --endpoint with --role client", async () => {
      const { stdout } = await runCommand(
        [
          "ai-transport:demo:streaming",
          "--role",
          "client",
          "--endpoint",
          "http://localhost:3000",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("Role: client");
    });
  });

  describe("error handling", () => {
    it("should reject invalid role values", async () => {
      const { error } = await runCommand(
        ["ai-transport:demo:streaming", "--role", "invalid"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
