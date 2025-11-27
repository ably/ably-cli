import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";

// Helper function to get a temporary config directory
const getTestConfigDir = () =>
  path.join(os.tmpdir(), `ably-cli-test-${Date.now()}`);

describe("Help commands integration", function () {
  let configDir: string;
  let originalConfigDir: string;

  beforeEach(function () {
    // Create a temporary directory for config for each test
    configDir = getTestConfigDir();
    fs.ensureDirSync(configDir);

    // Store and set config directory
    originalConfigDir = process.env.ABLY_CLI_CONFIG_DIR || "";
    process.env.ABLY_CLI_CONFIG_DIR = configDir;
  });

  afterEach(function () {
    // Restore original config directory
    if (originalConfigDir) {
      process.env.ABLY_CLI_CONFIG_DIR = originalConfigDir;
    } else {
      delete process.env.ABLY_CLI_CONFIG_DIR;
    }

    // Clean up the temporary config directory
    fs.removeSync(configDir);
  });

  describe("root help command", function () {
    it("should show all high-level topics", async function () {
      const { stdout, stderr } = await runCommand(["--help"], import.meta.url);

      // Allow warnings in stderr (e.g., version mismatch warnings), otherwise should be empty
      expect(!stderr || stderr.includes("Warning:")).toBe(true);
      expect(stdout).toContain("USAGE");
      // Check for some core topics
      expect(stdout).toContain("ably.com CLI for Pub/Sub");
      expect(stdout).toContain("COMMANDS");
    });
  });
});
