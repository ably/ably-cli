import { describe, it, expect } from "vitest";
import { runCommand } from "@oclif/test";

describe("config:path command", () => {
  describe("successful config path display", () => {
    it("should display the config path", async () => {
      const { stdout } = await runCommand(["config:path"], import.meta.url);

      // MockConfigManager returns "/mock/config/path"
      expect(stdout).toContain("/mock/config/path");
    });

    it("should output JSON format when --json flag is used", async () => {
      const { stdout } = await runCommand(
        ["config:path", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("path");
      expect(result.path).toBe("/mock/config/path");
    });

    it("should output pretty JSON format when --pretty-json flag is used", async () => {
      const { stdout } = await runCommand(
        ["config:path", "--pretty-json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("path");
      expect(result.path).toBe("/mock/config/path");
    });
  });

  describe("command flags", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["config:path", "--unknown-flag-xyz"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });
});
