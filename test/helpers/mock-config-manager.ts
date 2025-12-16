/**
 * Mock ConfigManager for unit tests.
 *
 * NOTE: Initialization and reset are handled automatically by test/unit/setup.ts.
 * You do NOT need to call initializeMockConfigManager() or resetMockConfig()
 * in your tests - just use getMockConfigManager() to access and configure the mock.
 *
 * @example
 * import { getMockConfigManager } from "../../helpers/mock-config-manager.js";
 *
 * // Get values through ConfigManager interface methods
 * const mockConfig = getMockConfigManager();
 * const appId = mockConfig.getCurrentAppId()!;
 * const apiKey = mockConfig.getApiKey()!;
 * const accountId = mockConfig.getCurrentAccount()!.accountId!;
 *
 * // Manipulate config for error scenarios
 * mockConfig.setCurrentAccountAlias(undefined); // Test "no account" error
 * mockConfig.clearAccounts(); // Test "no config" scenario
 */

import type {
  AblyConfig,
  AccountConfig,
  AppConfig,
  ConfigManager,
} from "../../src/services/config-manager.js";

/**
 * Type for test configuration values.
 */
export interface TestConfigValues {
  accessToken: string;
  accountId: string;
  accountName: string;
  userEmail: string;
  appId: string;
  appName: string;
  apiKey: string;
  keyId: string;
  keyName: string;
  accountAlias: string;
}

/**
 * Generate a random string of specified length for test isolation.
 */
function randomString(length: number): string {
  return Math.random()
    .toString(36)
    .slice(2, 2 + length);
}

/**
 * Generate random test config values.
 * Each call produces unique values to ensure test isolation.
 */
function generateTestConfig(): TestConfigValues {
  const appId = randomString(6);
  const keyId = `${appId}.key${randomString(6)}`;
  const keySecret = `secret${randomString(12)}`;

  return {
    accessToken: `token_${randomString(16)}`,
    accountId: `acc_${randomString(12)}`,
    accountName: `Test Account ${randomString(4)}`,
    userEmail: `test_${randomString(6)}@example.com`,
    appId,
    appName: `Test App ${randomString(4)}`,
    apiKey: `${keyId}:${keySecret}`,
    keyId,
    keyName: `Test Key ${randomString(4)}`,
    accountAlias: "default",
  };
}

/**
 * In-memory mock implementation of ConfigManager for testing.
 * This allows tests to run without filesystem operations.
 */
export class MockConfigManager implements ConfigManager {
  private config: AblyConfig;
  private testValues: TestConfigValues;

  constructor(initialConfig?: AblyConfig) {
    this.testValues = generateTestConfig();
    this.config = initialConfig ?? this.createDefaultConfig();
  }

  /**
   * Get the current test configuration values (internal use only).
   * Tests should use ConfigManager interface methods instead.
   */
  private getTestValues(): TestConfigValues {
    return { ...this.testValues };
  }

  /**
   * Get a registered app ID from the mock config.
   * This returns an appId that exists in the config's apps list,
   * even if currentAppId has been set to undefined.
   * Useful for tests that need to set up nock mocks after modifying config state.
   */
  public getRegisteredAppId(): string {
    const currentAccount = this.getCurrentAccount();
    if (currentAccount?.apps) {
      const appIds = Object.keys(currentAccount.apps);
      if (appIds.length > 0) {
        return appIds[0];
      }
    }
    // Fallback to testValues appId
    return this.testValues.appId;
  }

  /**
   * Creates a default config that satisfies most test requirements.
   */
  private createDefaultConfig(): AblyConfig {
    const {
      accessToken,
      accountId,
      accountName,
      userEmail,
      appId,
      appName,
      apiKey,
      keyId,
      keyName,
      accountAlias,
    } = this.testValues;

    return {
      current: {
        account: accountAlias,
      },
      accounts: {
        [accountAlias]: {
          accessToken,
          accountId,
          accountName,
          userEmail,
          currentAppId: appId,
          apps: {
            [appId]: {
              apiKey,
              appName,
              keyId,
              keyName,
            },
          },
        },
      },
    };
  }

  /**
   * Reset the config to default values with new randomized test values.
   * Useful for test cleanup or starting fresh.
   */
  public reset(): void {
    this.testValues = generateTestConfig();
    this.config = this.createDefaultConfig();
  }

  /**
   * Set a completely custom config.
   * Useful for tests that need specific configurations.
   */
  public setConfig(config: AblyConfig): void {
    this.config = config;
  }

  /**
   * Get the current raw config (for test assertions).
   */
  public getConfig(): AblyConfig {
    return this.config;
  }

  /**
   * Set the current account alias.
   */
  public setCurrentAccountAlias(alias: string | undefined): void {
    if (!this.config.current) {
      this.config.current = {};
    }
    this.config.current.account = alias;
  }

  /**
   * Set the current app ID for the current account.
   */
  public setCurrentAppIdForAccount(appId: string | undefined): void {
    const currentAccount = this.getCurrentAccount();
    const currentAlias = this.getCurrentAccountAlias();
    if (currentAccount && currentAlias) {
      this.config.accounts[currentAlias].currentAppId = appId;
    }
  }

  /**
   * Clear all accounts (useful for testing error scenarios).
   */
  public clearAccounts(): void {
    this.config.accounts = {};
    if (this.config.current) {
      delete this.config.current.account;
    }
  }

  // ConfigManager interface implementation

  public clearHelpContext(): void {
    delete this.config.helpContext;
  }

  public getAccessToken(alias?: string): string | undefined {
    if (alias) {
      return this.config.accounts[alias]?.accessToken;
    }
    const currentAccount = this.getCurrentAccount();
    return currentAccount?.accessToken;
  }

  public getApiKey(appId?: string): string | undefined {
    const currentAccount = this.getCurrentAccount();
    if (!currentAccount || !currentAccount.apps) {
      return process.env.ABLY_API_KEY;
    }

    const targetAppId = appId || this.getCurrentAppId();
    if (!targetAppId) {
      return process.env.ABLY_API_KEY;
    }

    return currentAccount.apps[targetAppId]?.apiKey || process.env.ABLY_API_KEY;
  }

  public getAppName(appId: string): string | undefined {
    const currentAccount = this.getCurrentAccount();
    if (!currentAccount || !currentAccount.apps) return undefined;
    return currentAccount.apps[appId]?.appName;
  }

  public getAppConfig(appId: string): AppConfig | undefined {
    const currentAccount = this.getCurrentAccount();
    if (!currentAccount || !currentAccount.apps) return undefined;
    const cfg = currentAccount.apps[appId];
    return cfg ? { ...cfg } : undefined;
  }

  public getConfigPath(): string {
    return "/mock/config/path";
  }

  public getCurrentAccount(): AccountConfig | undefined {
    const currentAlias = this.getCurrentAccountAlias();
    if (!currentAlias) return undefined;
    return this.config.accounts[currentAlias];
  }

  public getCurrentAccountAlias(): string | undefined {
    return this.config.current?.account;
  }

  public getCurrentAppId(): string | undefined {
    const currentAccount = this.getCurrentAccount();
    if (!currentAccount) return undefined;
    return currentAccount.currentAppId;
  }

  public getHelpContext():
    | {
        conversation: {
          messages: {
            content: string;
            role: "assistant" | "user";
          }[];
        };
      }
    | undefined {
    return this.config.helpContext;
  }

  public getKeyId(appId?: string): string | undefined {
    const currentAccount = this.getCurrentAccount();
    if (!currentAccount || !currentAccount.apps) return undefined;

    const targetAppId = appId || this.getCurrentAppId();
    if (!targetAppId) return undefined;

    const appConfig = currentAccount.apps[targetAppId];
    if (!appConfig) return undefined;

    if (appConfig.keyId) {
      return appConfig.keyId;
    }

    if (appConfig.apiKey) {
      return appConfig.apiKey.split(":")[0];
    }

    return undefined;
  }

  public getKeyName(appId?: string): string | undefined {
    const currentAccount = this.getCurrentAccount();
    if (!currentAccount || !currentAccount.apps) return undefined;

    const targetAppId = appId || this.getCurrentAppId();
    if (!targetAppId) return undefined;

    return currentAccount.apps[targetAppId]?.keyName;
  }

  public listAccounts(): { account: AccountConfig; alias: string }[] {
    return Object.entries(this.config.accounts).map(([alias, account]) => ({
      account,
      alias,
    }));
  }

  public removeAccount(alias: string): boolean {
    if (!this.config.accounts[alias]) {
      return false;
    }

    delete this.config.accounts[alias];

    if (this.config.current?.account === alias) {
      delete this.config.current.account;
    }

    return true;
  }

  public removeApiKey(appId: string): boolean {
    const currentAccount = this.getCurrentAccount();
    if (!currentAccount || !currentAccount.apps) return false;

    if (currentAccount.apps[appId]) {
      delete currentAccount.apps[appId].apiKey;
      return true;
    }

    return false;
  }

  public saveConfig(): void {
    // No-op for in-memory implementation
  }

  public setCurrentApp(appId: string): void {
    const currentAccount = this.getCurrentAccount();
    const currentAlias = this.getCurrentAccountAlias();

    if (!currentAccount || !currentAlias) {
      throw new Error("No current account selected");
    }

    this.config.accounts[currentAlias].currentAppId = appId;
  }

  public storeAccount(
    accessToken: string,
    alias: string = "default",
    accountInfo?: {
      accountId?: string;
      accountName?: string;
      tokenId?: string;
      userEmail?: string;
    },
  ): void {
    this.config.accounts[alias] = {
      accessToken,
      ...accountInfo,
      apps: this.config.accounts[alias]?.apps || {},
      currentAppId: this.config.accounts[alias]?.currentAppId,
    };

    if (!this.config.current || !this.config.current.account) {
      this.config.current = { account: alias };
    }
  }

  public storeAppInfo(
    appId: string,
    appInfo: { appName: string },
    accountAlias?: string,
  ): void {
    const alias = accountAlias || this.getCurrentAccountAlias() || "default";

    if (!this.config.accounts[alias]) {
      throw new Error(`Account "${alias}" not found`);
    }

    if (!this.config.accounts[alias].apps) {
      this.config.accounts[alias].apps = {};
    }

    this.config.accounts[alias].apps[appId] = {
      ...this.config.accounts[alias].apps[appId],
      ...appInfo,
    };
  }

  public storeAppKey(
    appId: string,
    apiKey: string,
    metadata?: {
      appName?: string;
      keyId?: string;
      keyName?: string;
    },
    accountAlias?: string,
  ): void {
    const alias = accountAlias || this.getCurrentAccountAlias() || "default";

    if (!this.config.accounts[alias]) {
      throw new Error(`Account "${alias}" not found`);
    }

    if (!this.config.accounts[alias].apps) {
      this.config.accounts[alias].apps = {};
    }

    this.config.accounts[alias].apps[appId] = {
      ...this.config.accounts[alias].apps[appId],
      apiKey,
      appName: metadata?.appName,
      keyId: metadata?.keyId || apiKey.split(":")[0],
      keyName: metadata?.keyName,
    };
  }

  public storeHelpContext(question: string, answer: string): void {
    if (!this.config.helpContext) {
      this.config.helpContext = {
        conversation: {
          messages: [],
        },
      };
    }

    this.config.helpContext.conversation.messages.push(
      {
        content: question,
        role: "user",
      },
      {
        content: answer,
        role: "assistant",
      },
    );
  }

  public switchAccount(alias: string): boolean {
    if (!this.config.accounts[alias]) {
      return false;
    }

    if (!this.config.current) {
      this.config.current = {};
    }

    this.config.current.account = alias;
    return true;
  }
}

/**
 * Get the MockConfigManager instance from globals.
 * Throws if not in test mode or mock not initialized.
 */
export function getMockConfigManager(): MockConfigManager {
  if (!globalThis.__TEST_MOCKS__?.configManager) {
    throw new Error(
      "MockConfigManager not initialized. Ensure you are running unit tests with the proper setup.",
    );
  }
  return globalThis.__TEST_MOCKS__.configManager as MockConfigManager;
}

/**
 * Reset the mock config manager to default values.
 * Call this in beforeEach or when you need a fresh config.
 */
export function resetMockConfig(): void {
  const mock = getMockConfigManager();
  mock.reset();
}

/**
 * Initialize the mock config manager on globals.
 * This is called by the unit test setup file.
 */
export function initializeMockConfigManager(): void {
  globalThis.__TEST_MOCKS__ = {
    ...globalThis.__TEST_MOCKS__,
    configManager: new MockConfigManager(),
  };
}

/**
 * Check if mock config manager is available.
 */
export function hasMockConfigManager(): boolean {
  return !!globalThis.__TEST_MOCKS__?.configManager;
}
