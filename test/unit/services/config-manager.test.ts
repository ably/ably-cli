/**
 * ConfigManager unit tests
 *
 * Explicitly sets NODE_TEST_CONTEXT to isolate this test file
 * from other tests that might be using Ably connections.
 */

// Set test isolation marker to prevent Ably connection conflicts
process.env.NODE_TEST_CONTEXT = "config-manager-only";

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  vi,
} from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ConfigManager,
  TomlConfigManager,
} from "../../../src/services/config-manager.js";

// Simple mock config content
const DEFAULT_CONFIG = `
[current]
account = "default"

[accounts.default]
accessToken = "testaccesstoken"
accountId = "testaccountid"
accountName = "Test Account"
currentAppId = "testappid"

[accounts.default.apps.testappid]
apiKey = "testappid.keyid:keysecret"
appName = "Test App"
keyId = "testappid.keyid"
keyName = "Test Key"
`;

// Completely isolated test suite
describe("ConfigManager", () => {
  // Variables declared at top level for test scope
  let configManager: ConfigManager;
  let envBackup: Record<string, string | undefined>;
  // Backup original env vars that might interfere with tests
  let originalConfigDirEnvVar: string | undefined;

  // Store a unique temporary directory for test config for this file
  let uniqueTestConfigDir: string;

  // Setup unique temp directory for this test file
  beforeAll(() => {
    // Create a unique temporary directory for this test suite
    uniqueTestConfigDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "ably-cli-config-test-"),
    );
  });

  // Setup test environment for each test
  beforeEach(() => {
    // Backup potentially interfering env vars
    envBackup = {
      ABLY_CLI_TEST_MODE: process.env.ABLY_CLI_TEST_MODE,
      ABLY_API_KEY: process.env.ABLY_API_KEY,
      ABLY_ACCESS_TOKEN: process.env.ABLY_ACCESS_TOKEN,
    };
    originalConfigDirEnvVar = process.env.ABLY_CLI_CONFIG_DIR;

    // Override config dir to use the unique temp dir
    process.env.ABLY_CLI_CONFIG_DIR = uniqueTestConfigDir;
    process.env.ABLY_CLI_TEST_MODE = "true";
    delete process.env.ABLY_API_KEY;
    delete process.env.ABLY_ACCESS_TOKEN;

    // Create a sandbox for stubs
    // Stub filesystem operations within the sandbox
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "mkdirSync"); // Allow mkdirSync to be called
    vi.spyOn(fs, "readFileSync").mockReturnValue(DEFAULT_CONFIG);
    vi.spyOn(fs, "writeFileSync");

    // Create new ConfigManager instance for each test
    // It will now use the uniqueTestConfigDir via the env var
    configManager = new TomlConfigManager();
  });

  // Clean up after each test
  afterEach(() => {
    // Restore all vitest stubs
    vi.restoreAllMocks();
    // Restore environment variables
    if (envBackup.ABLY_CLI_TEST_MODE) {
      process.env.ABLY_CLI_TEST_MODE = envBackup.ABLY_CLI_TEST_MODE;
    } else {
      delete process.env.ABLY_CLI_TEST_MODE;
    }
    if (envBackup.ABLY_API_KEY) {
      process.env.ABLY_API_KEY = envBackup.ABLY_API_KEY;
    } else {
      delete process.env.ABLY_API_KEY;
    }
    if (envBackup.ABLY_ACCESS_TOKEN) {
      process.env.ABLY_ACCESS_TOKEN = envBackup.ABLY_ACCESS_TOKEN;
    } else {
      delete process.env.ABLY_ACCESS_TOKEN;
    }
    // Restore the original config dir env var
    if (originalConfigDirEnvVar === undefined) {
      delete process.env.ABLY_CLI_CONFIG_DIR;
    } else {
      process.env.ABLY_CLI_CONFIG_DIR = originalConfigDirEnvVar;
    }
  });

  // Clean up the unique temporary directory after all tests in this file
  afterAll(() => {
    if (uniqueTestConfigDir) {
      fs.rmSync(uniqueTestConfigDir, { recursive: true, force: true });
    }
    // Restore any other env vars if needed (currently handled in afterEach)
  });

  // Tests for constructor
  describe("#constructor", () => {
    it("should attempt to create config directory if it doesn't exist", () => {
      // Need to reset the sandbox stubs for this specific test case
      const mkdirStub = vi.spyOn(fs, "mkdirSync").mockImplementation(vi.fn());
      const existsStub = vi.spyOn(fs, "existsSync");
      vi.spyOn(fs, "readFileSync").mockReturnValue(""); // Simulate no existing config

      // Make config dir not exist initially
      existsStub.mockReturnValue(false);

      // Create instance which should trigger directory creation attempt
      const _manager = new TomlConfigManager();

      // ConfigManager constructor now uses getConfigDirPath() which relies on ABLY_CLI_CONFIG_DIR
      // We expect mkdirSync to be called with the uniqueTestConfigDir
      expect(mkdirStub).toHaveBeenCalledWith(uniqueTestConfigDir, {
        mode: 0o700,
      });
    });

    it("should load existing config file", () => {
      // The beforeEach setup already stubs readFileSync
      // ConfigManager constructor calls loadConfig, which calls readFileSync
      const readFileStub = fs.readFileSync as ReturnType<typeof vi.fn>;

      // Verify it tries to read the correct file within the temp dir
      const expectedConfigPath = path.join(uniqueTestConfigDir, "config");

      expect(readFileStub).toHaveBeenCalledExactlyOnceWith(
        expectedConfigPath,
        "utf8",
      );
    });
  });

  // Tests for getCurrentAccountAlias
  describe("#getCurrentAccountAlias", () => {
    it("should return the current account alias", () => {
      expect(configManager.getCurrentAccountAlias()).toBe("default");
    });

    it("should return undefined if no current account", () => {
      // Reset stubs and load empty config
      // Restore stubs from beforeEach
      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      vi.spyOn(fs, "readFileSync").mockReturnValue("[accounts]\n"); // Empty accounts section
      vi.spyOn(fs, "writeFileSync"); // Stub writeFileSync if needed

      const manager = new TomlConfigManager(); // Create new instance with empty config

      expect(manager.getCurrentAccountAlias()).toBeUndefined();
    });
  });

  // Tests for getCurrentAccount
  describe("#getCurrentAccount", () => {
    it("should return the current account", () => {
      const account = configManager.getCurrentAccount();

      expect(account).not.toBeUndefined();
      expect(account?.accessToken).toBe("testaccesstoken");
      expect(account?.accountId).toBe("testaccountid");
      expect(account?.accountName).toBe("Test Account");
    });

    it("should return undefined if no current account alias", () => {
      // Reset stubs and load config without current section
      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      vi.spyOn(fs, "readFileSync").mockReturnValue(`
[accounts.default]
accessToken = "testaccesstoken"
`); // No [current] section
      vi.spyOn(fs, "writeFileSync");

      const manager = new TomlConfigManager();

      expect(manager.getCurrentAccount()).toBeUndefined();
    });
  });

  // Tests for getCurrentAppId
  describe("#getCurrentAppId", () => {
    it("should return the current app ID", () => {
      expect(configManager.getCurrentAppId()).toBe("testappid");
    });

    it("should return undefined if no current account", () => {
      // Reset stubs and load config without current section
      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      vi.spyOn(fs, "readFileSync").mockReturnValue(`[accounts]`); // No [current] section or account details
      vi.spyOn(fs, "writeFileSync");

      const manager = new TomlConfigManager();
      expect(manager.getCurrentAppId()).toBeUndefined();
    });
  });

  // Tests for getApiKey
  describe("#getApiKey", () => {
    it("should return the API key for the current app", () => {
      expect(configManager.getApiKey()).toBe("testappid.keyid:keysecret");
    });

    it("should return the API key for a specific app", () => {
      expect(configManager.getApiKey("testappid")).toBe(
        "testappid.keyid:keysecret",
      );
    });

    it("should return undefined if app doesn't exist", () => {
      expect(configManager.getApiKey("nonexistentappid")).toBeUndefined();
    });
  });

  // Tests for getAppName
  describe("#getAppName", () => {
    it("should return the app name for a specific app", () => {
      expect(configManager.getAppName("testappid")).toBe("Test App");
    });

    it("should return undefined if app doesn't exist", () => {
      expect(configManager.getAppName("nonexistentappid")).toBeUndefined();
    });
  });

  // Tests for storeAccount
  describe("#storeAccount", () => {
    it("should store a new account", () => {
      const writeFileStub = fs.writeFileSync as ReturnType<typeof vi.fn>;
      configManager.storeAccount("newaccesstoken", "newaccount", {
        accountId: "newaccountid",
        accountName: "New Account",
      });

      expect(writeFileStub).toHaveBeenCalledOnce();

      // Test that the internal state is updated
      const accounts = configManager.listAccounts();
      expect(accounts.some((a) => a.alias === "newaccount")).toBe(true);

      const account = accounts.find((a) => a.alias === "newaccount")?.account;
      expect(account?.accessToken).toBe("newaccesstoken");
      expect(account?.accountId).toBe("newaccountid");
      expect(account?.accountName).toBe("New Account");
    });

    it("should set as current if it's the first account", () => {
      // Reset stubs and load empty config
      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      vi.spyOn(fs, "readFileSync").mockReturnValue(""); // Empty config
      const writeFileStub = vi.spyOn(fs, "writeFileSync");

      const manager = new TomlConfigManager();
      manager.storeAccount("firstaccesstoken", "firstaccount");

      expect(writeFileStub).toHaveBeenCalledOnce();
      expect(manager.getCurrentAccountAlias()).toBe("firstaccount");
    });
  });

  // Tests for storeAppKey
  describe("#storeAppKey", () => {
    it("should store an API key for an app", () => {
      const writeFileStub = fs.writeFileSync as ReturnType<typeof vi.fn>;
      configManager.storeAppKey("newappid", "newappid.keyid:keysecret", {
        appName: "New App",
        keyName: "New Key",
      });

      expect(writeFileStub).toHaveBeenCalledOnce();

      // Check that the key was stored
      expect(configManager.getApiKey("newappid")).toBe(
        "newappid.keyid:keysecret",
      );
      expect(configManager.getAppName("newappid")).toBe("New App");
      expect(configManager.getKeyName("newappid")).toBe("New Key");
    });

    it("should store an API key for an app with a specific account", () => {
      const writeFileStub = fs.writeFileSync as ReturnType<typeof vi.fn>;
      // First create a new account
      configManager.storeAccount("anotheraccesstoken", "anotheraccount");

      configManager.storeAppKey(
        "anotherappid",
        "anotherappid.keyid:keysecret",
        {
          appName: "Another App",
          keyName: "Another Key",
        },
        "anotheraccount",
      );

      // Switch to the other account
      configManager.switchAccount("anotheraccount");

      // Check that the key was stored properly
      expect(configManager.getApiKey("anotherappid")).toBe(
        "anotherappid.keyid:keysecret",
      );
      expect(configManager.getAppName("anotherappid")).toBe("Another App");
      expect(configManager.getKeyName("anotherappid")).toBe("Another Key");

      // Expect writeFileSync to have been called multiple times (storeAccount, storeAppKey, switchAccount)
      expect(writeFileStub?.mock.calls.length).toBeGreaterThan(2);
    });

    it("should throw error if account doesn't exist", () => {
      expect(() => {
        configManager.storeAppKey("appid", "apikey", {}, "nonexistentaccount");
      }).toThrow();
    });
  });

  // Tests for removeAccount
  describe("#removeAccount", () => {
    it("should remove an account and return true", () => {
      const writeFileStub = fs.writeFileSync as ReturnType<typeof vi.fn>;
      expect(configManager.removeAccount("default")).toBe(true);
      expect(writeFileStub).toHaveBeenCalledOnce();

      // The account should be gone from the list
      expect(
        configManager.listAccounts().some((a) => a.alias === "default"),
      ).toBe(false);
    });

    it("should return false if account doesn't exist", () => {
      expect(configManager.removeAccount("nonexistentaccount")).toBe(false);
    });

    it("should clear current account if removing current account", () => {
      const writeFileStub = fs.writeFileSync as ReturnType<typeof vi.fn>;
      // First confirm default is the current account
      expect(configManager.getCurrentAccountAlias()).toBe("default");

      // Remove it
      configManager.removeAccount("default");

      // Current account should now be undefined
      expect(configManager.getCurrentAccountAlias()).toBeUndefined();
      expect(writeFileStub).toHaveBeenCalledOnce();
    });
  });

  // Tests for switchAccount
  describe("#switchAccount", () => {
    it("should switch to another account and return true", () => {
      const writeFileStub = fs.writeFileSync as ReturnType<typeof vi.fn>;
      // First create another account
      configManager.storeAccount("anotheraccesstoken", "anotheraccount");

      expect(configManager.switchAccount("anotheraccount")).toBe(true);
      // writeFileSync called for storeAccount and switchAccount
      expect(writeFileStub).toHaveBeenCalledTimes(2);

      // Current account should be the new one
      expect(configManager.getCurrentAccountAlias()).toBe("anotheraccount");
    });

    it("should return false if account doesn't exist", () => {
      expect(configManager.switchAccount("nonexistentaccount")).toBe(false);
    });
  });
});
