import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  MockInstance,
} from "vitest";
import fs from "node:fs";
import { AblyBaseCommand } from "../../../src/base-command.js";
import {
  ConfigManager,
  TomlConfigManager,
} from "../../../src/services/config-manager.js";
import { InteractiveHelper } from "../../../src/services/interactive-helper.js";
import { BaseFlags } from "../../../src/types/cli.js";
import { Config } from "@oclif/core";

// Create a testable implementation of the abstract AblyBaseCommand
class TestCommand extends AblyBaseCommand {
  // Expose protected methods for testing
  public testCheckWebCliRestrictions(): void {
    this.checkWebCliRestrictions();
  }

  public testIsAllowedInWebCliMode(command?: string): boolean {
    return this.isAllowedInWebCliMode(command);
  }

  public testShouldOutputJson(flags: BaseFlags): boolean {
    return this.shouldOutputJson(flags);
  }

  public testParseApiKey(apiKey: string) {
    return this.parseApiKey(apiKey);
  }

  public testEnsureAppAndKey(
    flags: BaseFlags,
  ): Promise<{ apiKey: string; appId: string } | null> {
    return this.ensureAppAndKey(flags);
  }

  // Make protected properties accessible for testing
  public get testConfigManager(): ConfigManager {
    return this.configManager;
  }

  public set testConfigManager(value: ConfigManager) {
    this.configManager = value;
  }

  public get testInteractiveHelper(): InteractiveHelper {
    return this.interactiveHelper;
  }

  public set testInteractiveHelper(value: InteractiveHelper) {
    this.interactiveHelper = value;
  }

  public get testIsWebCliMode(): boolean {
    return this.isWebCliMode;
  }

  public set testIsWebCliMode(value: boolean) {
    this.isWebCliMode = value;
  }

  public testIsAnonymousWebMode(): boolean {
    return this.isAnonymousWebMode();
  }

  public testMatchesCommandPattern(
    commandId: string,
    pattern: string,
  ): boolean {
    return this.matchesCommandPattern(commandId, pattern);
  }

  public testIsRestrictedInAnonymousMode(commandId: string): boolean {
    return this.isRestrictedInAnonymousMode(commandId);
  }

  public testGetClientOptions(flags: BaseFlags): any {
    return this.getClientOptions(flags);
  }

  async run(): Promise<void> {
    // Empty implementation
  }
}

type MockConfigManager = ConfigManager & {
  getCurrentAppId: ReturnType<typeof vi.fn>;
  getApiKey: ReturnType<typeof vi.fn>;
  getAccessToken: ReturnType<typeof vi.fn>;
  selectKey: ReturnType<typeof vi.fn>;
  selectApp: ReturnType<typeof vi.fn>;
  setCurrentApp: ReturnType<typeof vi.fn>;
  storeAppInfo: ReturnType<typeof vi.fn>;
  storeAppKey: ReturnType<typeof vi.fn>;
};

type MockInteractiveHelper = InteractiveHelper & {
  getApiKey: ReturnType<typeof vi.fn>;
  selectKey: ReturnType<typeof vi.fn>;
  selectApp: ReturnType<typeof vi.fn>;
};

describe("AblyBaseCommand", function () {
  let command: TestCommand;
  let configManagerStub: MockConfigManager;
  let interactiveHelperStub: MockInteractiveHelper;
  let _fsExistsStub: MockInstance<typeof fs.existsSync>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(function () {
    // Store original env vars to restore after tests
    originalEnv = { ...process.env };

    // Reset env before each test
    process.env = { ...originalEnv };

    // Stub fs.existsSync to prevent file system operations
    _fsExistsStub = vi.spyOn(fs, "existsSync").mockReturnValue(true);

    // Also stub fs.readFileSync to prevent actual file access
    vi.spyOn(fs, "readFileSync").mockReturnValue("");

    // Create stubs for dependencies
    configManagerStub = {
      getCurrentAppId: vi.fn(),
      getApiKey: vi.fn(),
      getAccessToken: vi.fn(),
      selectKey: vi.fn(),
      selectApp: vi.fn(),
      setCurrentApp: vi.fn(),
      storeAppInfo: vi.fn(),
      storeAppKey: vi.fn(),
    } as MockConfigManager;

    // Instead of stubbing loadConfig which is private, we'll stub methods that might access the file system
    vi.spyOn(
      TomlConfigManager.prototype as any,
      "ensureConfigDirExists",
    ).mockImplementation(() => {});
    vi.spyOn(
      TomlConfigManager.prototype as any,
      "saveConfig",
    ).mockImplementation(() => {});

    // Note: createStubInstance doesn't need sandbox explicitly.
    interactiveHelperStub = {
      getApiKey: vi.fn(),
      selectKey: vi.fn(),
      selectApp: vi.fn(),
    } as MockInteractiveHelper;

    // Mock a minimal config
    const mockConfig = {
      root: "",
      // Mock other properties as needed
    } as unknown as Config;

    command = new TestCommand([], mockConfig);

    // Replace the command's dependencies with our stubs
    command.testConfigManager = configManagerStub;
    command.testInteractiveHelper = interactiveHelperStub;
  });

  afterEach(function () {
    // Restore original env
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("checkWebCliRestrictions", function () {
    it("should not throw error when not in web CLI mode", function () {
      command.testIsWebCliMode = false;
      expect(() => command.testCheckWebCliRestrictions()).not.toThrow();
    });

    it("should throw error when in authenticated web CLI mode and command is restricted", function () {
      command.testIsWebCliMode = true;
      process.env.ABLY_ANONYMOUS_USER_MODE = "false";
      // Mock command ID to be a restricted command
      Object.defineProperty(command, "id", {
        value: "accounts:login",
        configurable: true,
      });

      expect(() => command.testCheckWebCliRestrictions()).toThrow(
        /already logged in/,
      );
    });

    it("should not throw error when in authenticated web CLI mode but command is allowed", function () {
      command.testIsWebCliMode = true;
      process.env.ABLY_ANONYMOUS_USER_MODE = "false";
      // Mock command ID to be an allowed command
      Object.defineProperty(command, "id", {
        value: "channels:publish",
        configurable: true,
      });

      expect(() => command.testCheckWebCliRestrictions()).not.toThrow();
    });

    it("should throw error for anonymous-restricted commands in anonymous mode", function () {
      command.testIsWebCliMode = true;
      process.env.ABLY_ANONYMOUS_USER_MODE = "true";

      // Test various anonymous-restricted commands
      const testCases = [
        {
          id: "accounts:stats",
          expectedError:
            /Account management commands are only available when logged in/,
        },
        {
          id: "apps:list",
          expectedError:
            /App management commands are only available when logged in/,
        },
        {
          id: "auth:keys:list",
          expectedError: /API key management requires you to be logged in/,
        },
        {
          id: "auth:revoke-token",
          expectedError: /Token revocation requires you to be logged in/,
        },
        {
          id: "channels:list",
          expectedError: /not available in anonymous mode for privacy reasons/,
        },
        {
          id: "bench:channel",
          expectedError:
            /Benchmarking commands are only available when logged in/,
        },
        {
          id: "integrations:list",
          expectedError: /Integration management requires you to be logged in/,
        },
        {
          id: "queues:list",
          expectedError: /Queue management requires you to be logged in/,
        },
        {
          id: "logs:tail",
          expectedError: /not available in anonymous mode for privacy reasons/,
        },
      ];

      testCases.forEach(({ id, expectedError }) => {
        Object.defineProperty(command, "id", { value: id, configurable: true });
        expect(() => command.testCheckWebCliRestrictions()).toThrow(
          expectedError,
        );
      });
    });

    it("should allow non-restricted commands in anonymous mode", function () {
      command.testIsWebCliMode = true;
      process.env.ABLY_ANONYMOUS_USER_MODE = "true";

      // Test commands that should be allowed
      const allowedCommands = [
        "channels:publish",
        "rooms:get",
        "spaces:get",
        "help",
      ];

      allowedCommands.forEach((id) => {
        Object.defineProperty(command, "id", { value: id, configurable: true });
        expect(() => command.testCheckWebCliRestrictions()).not.toThrow();
      });
    });

    it("should throw error for base restricted commands in anonymous mode", function () {
      command.testIsWebCliMode = true;
      process.env.ABLY_ANONYMOUS_USER_MODE = "true";

      // Test base restricted commands with their specific error messages
      // Note: accounts:login is caught by the anonymous restrictions first since it starts with "accounts"
      const testCases = [
        {
          id: "accounts:login",
          expectedError:
            /Account management commands are only available when logged in/,
        },
        {
          id: "config",
          expectedError:
            /Local configuration is not supported in the web CLI\. Please install the CLI locally/,
        },
        {
          id: "config:set",
          expectedError:
            /Local configuration is not supported in the web CLI\. Please install the CLI locally/,
        },
        {
          id: "mcp",
          expectedError:
            /MCP server functionality is not available in the web CLI\. Please install the CLI locally/,
        },
        {
          id: "mcp:start-server",
          expectedError:
            /MCP server functionality is not available in the web CLI\. Please install the CLI locally/,
        },
        {
          id: "accounts:current",
          expectedError:
            /Account management commands are only available when logged in/,
        },
        {
          id: "accounts:switch",
          expectedError:
            /Account management commands are only available when logged in/,
        },
        {
          id: "apps:switch",
          expectedError:
            /App management commands are only available when logged in/,
        },
        {
          id: "apps:delete",
          expectedError:
            /App management commands are only available when logged in/,
        },
        {
          id: "auth:keys:switch",
          expectedError: /API key management requires you to be logged in/,
        },
      ];

      testCases.forEach(({ id, expectedError }) => {
        Object.defineProperty(command, "id", { value: id, configurable: true });
        expect(() => command.testCheckWebCliRestrictions()).toThrow(
          expectedError,
        );
      });
    });

    it("should allow auth:keys commands when authenticated in web CLI mode", function () {
      command.testIsWebCliMode = true;
      process.env.ABLY_ANONYMOUS_USER_MODE = "false"; // Authenticated

      // These should be allowed when authenticated
      const allowedCommands = [
        "auth:keys:list",
        "auth:keys:create",
        "auth:keys:revoke",
      ];

      allowedCommands.forEach((id) => {
        Object.defineProperty(command, "id", { value: id, configurable: true });
        expect(() => command.testCheckWebCliRestrictions()).not.toThrow();
      });
    });
  });

  describe("isAllowedInWebCliMode", function () {
    it("should return true when not in web CLI mode", function () {
      command.testIsWebCliMode = false;
      expect(command.testIsAllowedInWebCliMode()).toBe(true);
    });

    it("should return false for restricted commands", function () {
      command.testIsWebCliMode = true;
      expect(command.testIsAllowedInWebCliMode("accounts:login")).toBe(false);
      expect(command.testIsAllowedInWebCliMode("accounts:logout")).toBe(false);
      expect(command.testIsAllowedInWebCliMode("config")).toBe(false);
      expect(command.testIsAllowedInWebCliMode("config:set")).toBe(false);
      expect(command.testIsAllowedInWebCliMode("mcp")).toBe(false);
      expect(command.testIsAllowedInWebCliMode("mcp:start-server")).toBe(false);
    });

    it("should return true for allowed commands", function () {
      command.testIsWebCliMode = true;
      expect(command.testIsAllowedInWebCliMode("help")).toBe(true);
      expect(command.testIsAllowedInWebCliMode("channels:publish")).toBe(true);
    });
  });

  describe("shouldOutputJson", function () {
    it("should return true when json flag is true", function () {
      const flags: BaseFlags = { json: true };
      expect(command.testShouldOutputJson(flags)).toBe(true);
    });

    it("should return true when pretty-json flag is true", function () {
      const flags: BaseFlags = { "pretty-json": true };
      expect(command.testShouldOutputJson(flags)).toBe(true);
    });

    it("should return true when format is json", function () {
      const flags: BaseFlags = { format: "json" };
      expect(command.testShouldOutputJson(flags)).toBe(true);
    });

    it("should return false when no json flags are present", function () {
      const flags: BaseFlags = {};
      expect(command.testShouldOutputJson(flags)).toBe(false);
    });
  });

  describe("parseApiKey", function () {
    it("should correctly parse a valid API key", function () {
      const validKey = "appId.keyId:keySecret";
      const result = command.testParseApiKey(validKey);

      expect(result).not.toBeNull();
      expect(result?.appId).toBe("appId");
      expect(result?.keyId).toBe("keyId");
      expect(result?.keySecret).toBe("keySecret");
    });

    it("should return null for an API key without colon", function () {
      const invalidKey = "appId.keyId";
      const result = command.testParseApiKey(invalidKey);

      expect(result).toBeNull();
    });

    it("should return null for an API key without period", function () {
      const invalidKey = "appIdkeyId:keySecret";
      const result = command.testParseApiKey(invalidKey);

      expect(result).toBeNull();
    });

    it("should return null for an empty API key", function () {
      expect(command.testParseApiKey("")).toBeNull();
    });
  });

  describe("Anonymous Web Mode", function () {
    let originalWebCliMode: string | undefined;
    let originalRestrictedMode: string | undefined;

    beforeEach(function () {
      originalWebCliMode = process.env.ABLY_WEB_CLI_MODE;
      originalRestrictedMode = process.env.ABLY_ANONYMOUS_USER_MODE;
    });

    afterEach(function () {
      if (originalWebCliMode === undefined) {
        delete process.env.ABLY_WEB_CLI_MODE;
      } else {
        process.env.ABLY_WEB_CLI_MODE = originalWebCliMode;
      }

      if (originalRestrictedMode === undefined) {
        delete process.env.ABLY_ANONYMOUS_USER_MODE;
      } else {
        process.env.ABLY_ANONYMOUS_USER_MODE = originalRestrictedMode;
      }
    });

    it("should detect anonymous mode when web CLI mode and ABLY_ANONYMOUS_USER_MODE is true", function () {
      process.env.ABLY_WEB_CLI_MODE = "true";
      process.env.ABLY_ANONYMOUS_USER_MODE = "true";

      const cmd = new TestCommand([], {} as Config);
      cmd.testConfigManager = configManagerStub;
      expect(cmd.testIsAnonymousWebMode()).toBe(true);
    });

    it("should not detect anonymous mode when ABLY_ANONYMOUS_USER_MODE is not set", function () {
      process.env.ABLY_WEB_CLI_MODE = "true";
      delete process.env.ABLY_ANONYMOUS_USER_MODE;

      const cmd = new TestCommand([], {} as Config);
      cmd.testConfigManager = configManagerStub;
      expect(cmd.testIsAnonymousWebMode()).toBe(false);
    });

    it("should not detect anonymous mode when ABLY_ANONYMOUS_USER_MODE is false", function () {
      process.env.ABLY_WEB_CLI_MODE = "true";
      process.env.ABLY_ANONYMOUS_USER_MODE = "false";

      const cmd = new TestCommand([], {} as Config);
      cmd.testConfigManager = configManagerStub;
      expect(cmd.testIsAnonymousWebMode()).toBe(false);
    });

    it("should not detect anonymous mode when not in web CLI mode", function () {
      delete process.env.ABLY_WEB_CLI_MODE;
      process.env.ABLY_ANONYMOUS_USER_MODE = "true";

      const cmd = new TestCommand([], {} as Config);
      cmd.testConfigManager = configManagerStub;
      expect(cmd.testIsAnonymousWebMode()).toBe(false);
    });

    it("should identify commands restricted in anonymous mode", function () {
      const cmd = new TestCommand([], {} as Config);
      cmd.testConfigManager = configManagerStub;

      // Commands with wildcards
      expect(cmd.testIsRestrictedInAnonymousMode("accounts")).toBe(true);
      expect(cmd.testIsRestrictedInAnonymousMode("accounts:list")).toBe(true);
      expect(cmd.testIsRestrictedInAnonymousMode("apps:create")).toBe(true);
      expect(cmd.testIsRestrictedInAnonymousMode("auth:keys:list")).toBe(true);
      expect(cmd.testIsRestrictedInAnonymousMode("bench:channel")).toBe(true);
      expect(
        cmd.testIsRestrictedInAnonymousMode("integrations:rules:create"),
      ).toBe(true);
      expect(cmd.testIsRestrictedInAnonymousMode("queues:publish")).toBe(true);
      expect(cmd.testIsRestrictedInAnonymousMode("logs:tail")).toBe(true);

      // Specific commands
      expect(cmd.testIsRestrictedInAnonymousMode("channels:list")).toBe(true);
      expect(cmd.testIsRestrictedInAnonymousMode("rooms:list")).toBe(true);
      expect(cmd.testIsRestrictedInAnonymousMode("auth:revoke-token")).toBe(
        true,
      );

      // Commands that should be allowed
      expect(cmd.testIsRestrictedInAnonymousMode("channels:publish")).toBe(
        false,
      );
      expect(cmd.testIsRestrictedInAnonymousMode("rooms:get")).toBe(false);
    });

    it("should match command patterns correctly", function () {
      const cmd = new TestCommand([], {} as Config);
      cmd.testConfigManager = configManagerStub;

      // Wildcard patterns
      expect(cmd.testMatchesCommandPattern("accounts", "accounts*")).toBe(true);
      expect(cmd.testMatchesCommandPattern("accounts:list", "accounts*")).toBe(
        true,
      );
      expect(
        cmd.testMatchesCommandPattern("accountsettings", "accounts*"),
      ).toBe(true);

      // Exact matches
      expect(
        cmd.testMatchesCommandPattern("channels:list", "channels:list"),
      ).toBe(true);
      expect(
        cmd.testMatchesCommandPattern("channels:list", "channels:lis"),
      ).toBe(false);

      // Non-matches
      expect(
        cmd.testMatchesCommandPattern("channels:publish", "channels:list"),
      ).toBe(false);
      expect(cmd.testMatchesCommandPattern("account", "accounts*")).toBe(false);
    });
  });

  describe("ensureAppAndKey", function () {
    it("should use app and key from flags if available", async function () {
      const flags: BaseFlags = {
        app: "testAppId",
        "api-key": "testApiKey",
      };

      const result = await command.testEnsureAppAndKey(flags);

      expect(result).not.toBeNull();
      expect(result?.appId).toBe("testAppId");
      expect(result?.apiKey).toBe("testApiKey");
    });

    it("should use app and key from config if available", async function () {
      const flags: BaseFlags = {};

      configManagerStub.getCurrentAppId.mockReturnValue("configAppId");
      configManagerStub.getApiKey.mockReturnValue("configApiKey");

      const result = await command.testEnsureAppAndKey(flags);

      expect(result).not.toBeNull();
      expect(result?.appId).toBe("configAppId");
      expect(result?.apiKey).toBe("configApiKey");
      expect(configManagerStub.getApiKey).toHaveBeenCalledWith("configAppId");
    });

    it("should use ABLY_API_KEY environment variable if available", async function () {
      const flags: BaseFlags = {};

      // Reset relevant stubs
      configManagerStub.getCurrentAppId.mockReturnValue(undefined as any);
      configManagerStub.getApiKey.mockReturnValue(undefined as any);
      // Set access token to ensure the control API path is followed
      configManagerStub.getAccessToken.mockReturnValue("test-token");

      // Set up interactive helper to simulate user selecting an app and key
      const mockApp = { id: "envApp", name: "Test App" } as any;
      const mockKey = {
        id: "keyId",
        name: "Test Key",
        key: "envApp.keyId:keySecret",
      } as any;

      interactiveHelperStub.selectApp.mockResolvedValue(mockApp);
      interactiveHelperStub.selectKey.mockResolvedValue(mockKey);

      // Set environment variable but it will be used in getClientOptions, not directly in this test path
      process.env.ABLY_API_KEY = "envApp.keyId:keySecret";

      const result = await command.testEnsureAppAndKey(flags);

      expect(result).not.toBeNull();
      expect(result?.appId).toBe("envApp");
      expect(result?.apiKey).toBe("envApp.keyId:keySecret");
      expect(interactiveHelperStub.selectKey).toHaveBeenCalledWith(
        expect.anything(),
        "envApp",
      );
    });

    it("should handle web CLI mode appropriately", async function () {
      const flags: BaseFlags = {};
      command.testIsWebCliMode = true;
      process.env.ABLY_API_KEY = "webApp.keyId:keySecret";

      const result = await command.testEnsureAppAndKey(flags);

      expect(result).not.toBeNull();
      expect(result?.appId).toBe("webApp");
      expect(result?.apiKey).toBe("webApp.keyId:keySecret");
    });

    it("should return null if no authentication is available", async function () {
      const flags: BaseFlags = {};

      // Reset all required stubs to return empty values
      configManagerStub.getCurrentAppId.mockReturnValue("" as any);
      configManagerStub.getApiKey.mockReturnValue("" as any);
      configManagerStub.getAccessToken.mockReturnValue("" as any);

      // Make sure environment variable is not set
      delete process.env.ABLY_API_KEY;

      const result = await command.testEnsureAppAndKey(flags);

      expect(result).toBeNull();
    });
  });

  describe("endpoint flag handling", function () {
    it("should set endpoint in client options when endpoint flag is provided", function () {
      const flags: BaseFlags = {
        endpoint: "custom-endpoint.example.com",
        "api-key": "test-key:secret",
      };

      const clientOptions = command.testGetClientOptions(flags);

      expect(clientOptions.endpoint).toBe("custom-endpoint.example.com");
    });

    it("should not set endpoint when flag is not provided", function () {
      const flags: BaseFlags = {
        "api-key": "test-key:secret",
      };

      const clientOptions = command.testGetClientOptions(flags);

      expect(clientOptions.endpoint).toBeUndefined();
    });

    it("should work alongside other flags like env and host", function () {
      const flags: BaseFlags = {
        endpoint: "custom-endpoint.example.com",
        env: "sandbox",
        host: "custom-host.example.com",
        "api-key": "test-key:secret",
      };

      const clientOptions = command.testGetClientOptions(flags);

      expect(clientOptions.endpoint).toBe("custom-endpoint.example.com");
      expect(clientOptions.environment).toBe("sandbox");
      expect(clientOptions.realtimeHost).toBe("custom-host.example.com");
      expect(clientOptions.restHost).toBe("custom-host.example.com");
    });
  });
});
