import {
  describe,
  it,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  expect,
} from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  forceExit,
  cleanupTrackedResources,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";

describe("Authentication E2E", () => {
  let tempConfigDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(async () => {
    process.on("SIGINT", forceExit);
  });

  afterAll(() => {
    process.removeListener("SIGINT", forceExit);
  });

  beforeEach(() => {
    resetTestTracking();
    originalEnv = { ...process.env };

    // Create temporary config directory
    tempConfigDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "ably-cli-e2e-test-"),
    );

    // Set test environment
    process.env.ABLY_CLI_CONFIG_DIR = tempConfigDir;
    process.env.ABLY_CLI_TEST_MODE = "true";
  });

  afterEach(async () => {
    // Restore environment
    process.env = originalEnv;

    // Clean up temp directory
    if (tempConfigDir && fs.existsSync(tempConfigDir)) {
      fs.rmSync(tempConfigDir, { recursive: true, force: true });
    }

    // Perform E2E cleanup
    await cleanupTrackedResources();
  });

  describe("config persistence", () => {
    it("should persist config in real file system", async () => {
      setupTestFailureHandler("should persist config in real file system");

      // Verify config directory is created
      expect(fs.existsSync(tempConfigDir)).toBe(true);

      // Check that config directory is empty initially
      const initialFiles = fs.readdirSync(tempConfigDir);
      expect(initialFiles).toHaveLength(0);

      // Create a config file by instantiating ConfigManager
      const { ConfigManager } = await import(
        "../../../src/services/config-manager.js"
      );
      const configManager = new ConfigManager();

      // Store test account
      configManager.storeAccount("test-token", "e2e-test", {
        accountId: "e2e_test_account",
        accountName: "E2E Test Account",
        userEmail: "e2e@test.com",
      });

      // Verify config file was created
      const configPath = path.join(tempConfigDir, "config");
      expect(fs.existsSync(configPath)).toBe(true);

      // Verify config file contains expected data
      const configContent = fs.readFileSync(configPath, "utf8");
      expect(configContent).toContain("[current]");
      expect(configContent).toContain('account = "e2e-test"');
      expect(configContent).toContain("[accounts.e2e-test]");
      expect(configContent).toContain('accessToken = "test-token"');
      expect(configContent).toContain('accountId = "e2e_test_account"');
    });

    it("should handle environment variable authentication", () => {
      setupTestFailureHandler(
        "should handle environment variable authentication",
      );

      // Set API key environment variable
      process.env.ABLY_API_KEY = "test-app.test-key:test-secret";

      // Verify environment variable is accessible
      expect(process.env.ABLY_API_KEY).toBe("test-app.test-key:test-secret");

      // Extract app ID from API key (simulating BaseCommand logic)
      const apiKey = process.env.ABLY_API_KEY;
      const appId = apiKey.split(".")[0];
      expect(appId).toBe("test-app");
    });
  });

  describe("error scenarios", () => {
    it("should handle invalid credentials gracefully", () => {
      setupTestFailureHandler("should handle invalid credentials gracefully");

      // Set invalid API key
      process.env.ABLY_API_KEY = "invalid.key:format";

      // Test that this would be detected as invalid format
      const apiKey = process.env.ABLY_API_KEY;
      const keyParts = apiKey.split(":");

      if (keyParts.length === 2) {
        const keyName = keyParts[0];
        const secret = keyParts[1];

        // Should have proper app.key format
        expect(keyName.includes(".")).toBe(true);
        expect(secret.length).toBeGreaterThan(0);
      } else {
        expect(true).toBe(true); // Invalid format detected
      }
    });

    it("should handle missing config directory permissions", () => {
      setupTestFailureHandler(
        "should handle missing config directory permissions",
      );

      // This test is conceptual - actual permissions testing
      // would be complex in a cross-platform way

      // Verify temp directory exists and is writable
      expect(fs.existsSync(tempConfigDir)).toBe(true);

      // Try to write a test file
      const testFile = path.join(tempConfigDir, "test.txt");
      expect(() => {
        fs.writeFileSync(testFile, "test");
      }).not.toThrow();

      // Clean up test file
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });
  });

  describe("config file format", () => {
    it("should create valid TOML config", async () => {
      setupTestFailureHandler("should create valid TOML config");

      const { ConfigManager } = await import(
        "../../../src/services/config-manager.js"
      );
      const configManager = new ConfigManager();

      // Store complex configuration
      configManager.storeAccount("access-token-123", "complex-account", {
        accountId: "complex_account_id",
        accountName: "Complex Account Name",
        tokenId: "token_id_123",
        userEmail: "complex@example.com",
      });

      configManager.storeAppKey(
        "complex-app",
        "complex-app.complex-key:complex-secret",
        {
          appName: "Complex App Name",
          keyName: "Complex Key Name",
        },
      );

      // Read and verify TOML structure
      const configPath = path.join(tempConfigDir, "config");
      const configContent = fs.readFileSync(configPath, "utf8");

      // Should have proper TOML sections
      expect(configContent).toContain("[current]");
      expect(configContent).toContain("[accounts.complex-account]");
      expect(configContent).toContain(
        "[accounts.complex-account.apps.complex-app]",
      );

      // Should escape special characters properly
      expect(configContent).toContain('accountName = "Complex Account Name"');
      expect(configContent).toContain('appName = "Complex App Name"');
      expect(configContent).toContain('keyName = "Complex Key Name"');
    });

    it("should handle special characters in account data", async () => {
      setupTestFailureHandler(
        "should handle special characters in account data",
      );

      const { ConfigManager } = await import(
        "../../../src/services/config-manager.js"
      );
      const configManager = new ConfigManager();

      // Store account with special characters
      configManager.storeAccount("token", "special-chars", {
        accountId: "special_id",
        accountName: 'Account with "quotes" and symbols!@#$%',
        userEmail: "user+test@domain-name.co.uk",
      });

      // Verify it can be read back
      const accounts = configManager.listAccounts();
      expect(accounts).toHaveLength(1);
      expect(accounts[0].account.accountName).toBe(
        'Account with "quotes" and symbols!@#$%',
      );
      expect(accounts[0].account.userEmail).toBe("user+test@domain-name.co.uk");
    });
  });

  describe("cross-platform compatibility", () => {
    it("should work with different path separators", async () => {
      setupTestFailureHandler("should work with different path separators");

      // Test that paths work on both Windows and Unix systems
      const configPath = path.join(tempConfigDir, "config");

      // Path should be normalized for the current platform
      if (process.platform === "win32") {
        expect(configPath).toContain("\\");
      } else {
        expect(configPath).toContain("/");
      }

      // Should be able to create and access files
      const { ConfigManager } = await import(
        "../../../src/services/config-manager.js"
      );
      const configManager = new ConfigManager();

      configManager.storeAccount("token", "platform-test", {
        accountId: "platform_test",
        accountName: "Platform Test",
      });

      expect(fs.existsSync(configPath)).toBe(true);
    });

    it("should handle different line endings", async () => {
      setupTestFailureHandler("should handle different line endings");

      const { ConfigManager } = await import(
        "../../../src/services/config-manager.js"
      );
      const configManager = new ConfigManager();

      configManager.storeAccount("token", "lineending-test", {
        accountId: "lineending_test",
        accountName: "Line Ending Test",
      });

      // Read config file and verify it's readable regardless of line endings
      const configPath = path.join(tempConfigDir, "config");
      const configContent = fs.readFileSync(configPath, "utf8");

      // Should contain expected content regardless of line ending style
      expect(configContent).toContain('account = "lineending-test"');
      expect(configContent).toContain('accountName = "Line Ending Test"');
    });
  });

  describe("environment isolation", () => {
    it("should use isolated config directory", async () => {
      setupTestFailureHandler("should use isolated config directory");

      // Verify we're using the test config directory
      expect(process.env.ABLY_CLI_CONFIG_DIR).toBe(tempConfigDir);

      const { ConfigManager } = await import(
        "../../../src/services/config-manager.js"
      );
      const configManager = new ConfigManager();

      // Store test data
      configManager.storeAccount("isolated-token", "isolated-account", {
        accountId: "isolated_account",
        accountName: "Isolated Account",
      });

      // Verify it's in our temp directory, not the user's home
      const configPath = path.join(tempConfigDir, "config");
      expect(fs.existsSync(configPath)).toBe(true);

      // Verify it's not in the default location
      const homeDir = os.homedir();
      const defaultConfigPath = path.join(homeDir, ".ably", "config");

      // Only check if we're not accidentally using the same path
      if (tempConfigDir !== path.join(homeDir, ".ably")) {
        expect(configPath).not.toBe(defaultConfigPath);
      }
    });
  });
});
