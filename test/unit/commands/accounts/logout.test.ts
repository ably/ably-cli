import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import { resolve } from "node:path";
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";

describe("accounts:logout command", () => {
  let testConfigDir: string;
  let originalConfigDir: string;

  beforeEach(() => {
    // Create a temporary config directory for testing
    testConfigDir = resolve(tmpdir(), `ably-cli-test-logout-${Date.now()}`);
    mkdirSync(testConfigDir, { recursive: true, mode: 0o700 });

    // Store original config dir and set test config dir
    originalConfigDir = process.env.ABLY_CLI_CONFIG_DIR || "";
    process.env.ABLY_CLI_CONFIG_DIR = testConfigDir;
  });

  afterEach(() => {
    // Restore original config directory
    if (originalConfigDir) {
      process.env.ABLY_CLI_CONFIG_DIR = originalConfigDir;
    } else {
      delete process.env.ABLY_CLI_CONFIG_DIR;
    }

    // Clean up test config directory
    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["accounts:logout", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Log out from an Ably account");
      expect(stdout).toContain("USAGE");
      expect(stdout).toContain("--force");
    });

    it("should display examples in help", async () => {
      const { stdout } = await runCommand(
        ["accounts:logout", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("EXAMPLES");
    });
  });

  describe("with no logged in accounts", () => {
    beforeEach(() => {
      // Create empty config
      const configContent = `[current]
`;
      writeFileSync(resolve(testConfigDir, "config"), configContent);
    });

    it("should output error in JSON format when no account is selected", async () => {
      const { stdout } = await runCommand(
        ["accounts:logout", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      expect(result.error).toContain("No account");
    });
  });

  describe("with logged in account", () => {
    beforeEach(() => {
      // Create config with a logged in account
      const configContent = `[current]
account = "testaccount"

[accounts.testaccount]
accessToken = "test_token_12345"
accountId = "acc-123"
accountName = "Test Account"
userEmail = "test@example.com"
`;
      writeFileSync(resolve(testConfigDir, "config"), configContent);
    });

    it("should successfully logout with --force and --json flags", async () => {
      const { stdout } = await runCommand(
        ["accounts:logout", "--force", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("account");
      expect(result.account).toHaveProperty("alias", "testaccount");
      expect(result).toHaveProperty("remainingAccounts");

      // Verify config file was updated - account should be removed
      const configContent = readFileSync(
        resolve(testConfigDir, "config"),
        "utf8",
      );
      expect(configContent).not.toContain("[accounts.testaccount]");
      expect(configContent).not.toContain("test_token_12345");
      expect(configContent).not.toContain("acc-123");
    });

    it("should logout specific account by alias with --force and --json", async () => {
      const { stdout } = await runCommand(
        ["accounts:logout", "testaccount", "--force", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result.account).toHaveProperty("alias", "testaccount");

      // Verify config file was updated - account should be removed
      const configContent = readFileSync(
        resolve(testConfigDir, "config"),
        "utf8",
      );
      expect(configContent).not.toContain("[accounts.testaccount]");
      expect(configContent).not.toContain("test_token_12345");
    });
  });

  describe("with multiple logged in accounts", () => {
    beforeEach(() => {
      // Create config with multiple accounts
      const configContent = `[current]
account = "primary"

[accounts.primary]
accessToken = "primary_token"
accountId = "acc-primary"
accountName = "Primary Account"
userEmail = "primary@example.com"

[accounts.secondary]
accessToken = "secondary_token"
accountId = "acc-secondary"
accountName = "Secondary Account"
userEmail = "secondary@example.com"
`;
      writeFileSync(resolve(testConfigDir, "config"), configContent);
    });

    it("should logout current account and show remaining accounts", async () => {
      const { stdout } = await runCommand(
        ["accounts:logout", "--force", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result.account).toHaveProperty("alias", "primary");
      expect(result.remainingAccounts).toContain("secondary");

      // Verify config file was updated - primary removed, secondary remains
      const configContent = readFileSync(
        resolve(testConfigDir, "config"),
        "utf8",
      );
      expect(configContent).not.toContain("[accounts.primary]");
      expect(configContent).not.toContain("primary_token");
      expect(configContent).toContain("[accounts.secondary]");
      expect(configContent).toContain("secondary_token");
      expect(configContent).toContain('accountName = "Secondary Account"');
    });

    it("should logout specific account when alias is provided", async () => {
      const { stdout } = await runCommand(
        ["accounts:logout", "secondary", "--force", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result.account).toHaveProperty("alias", "secondary");
      expect(result.remainingAccounts).toContain("primary");

      // Verify config file was updated - secondary removed, primary remains
      const configContent = readFileSync(
        resolve(testConfigDir, "config"),
        "utf8",
      );
      expect(configContent).not.toContain("[accounts.secondary]");
      expect(configContent).not.toContain("secondary_token");
      expect(configContent).toContain("[accounts.primary]");
      expect(configContent).toContain("primary_token");
      expect(configContent).toContain('accountName = "Primary Account"');
      // Current account should still be primary
      expect(configContent).toContain('account = "primary"');
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      // Create config with a logged in account
      const configContent = `[current]
account = "existingaccount"

[accounts.existingaccount]
accessToken = "test_token"
accountId = "acc-123"
accountName = "Test Account"
userEmail = "test@example.com"
`;
      writeFileSync(resolve(testConfigDir, "config"), configContent);
    });

    it("should output error in JSON format when account alias does not exist", async () => {
      const { stdout } = await runCommand(
        ["accounts:logout", "nonexistent", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      expect(result.error).toContain("not found");
    });
  });
});
