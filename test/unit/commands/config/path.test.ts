import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import { resolve } from "node:path";
import { mkdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

describe("config:path command", () => {
  let testConfigDir: string;
  let originalConfigDir: string;

  beforeEach(() => {
    testConfigDir = resolve(tmpdir(), `ably-cli-test-${Date.now()}`);
    mkdirSync(testConfigDir, { recursive: true, mode: 0o700 });

    originalConfigDir = process.env.ABLY_CLI_CONFIG_DIR || "";
    process.env.ABLY_CLI_CONFIG_DIR = testConfigDir;
  });

  afterEach(() => {
    if (originalConfigDir) {
      process.env.ABLY_CLI_CONFIG_DIR = originalConfigDir;
    } else {
      delete process.env.ABLY_CLI_CONFIG_DIR;
    }

    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe("successful config path display", () => {
    it("should display the config path", async () => {
      const { stdout } = await runCommand(["config:path"], import.meta.url);

      expect(stdout).toContain(testConfigDir);
      expect(stdout).toContain("config");
    });

    it("should output JSON format when --json flag is used", async () => {
      const { stdout } = await runCommand(
        ["config:path", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("path");
      expect(result.path).toContain(testConfigDir);
    });

    it("should output pretty JSON format when --pretty-json flag is used", async () => {
      const { stdout } = await runCommand(
        ["config:path", "--pretty-json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("path");
      expect(result.path).toContain(testConfigDir);
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
