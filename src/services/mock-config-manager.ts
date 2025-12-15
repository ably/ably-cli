import {
  AblyConfig,
  AccountConfig,
  AppConfig,
  ConfigManager,
} from "./config-manager.js";

/**
 * Default test values that match common test patterns across the codebase.
 * These values are used when no specific config is set.
 */
export const DEFAULT_TEST_CONFIG = {
  accessToken: "fake_access_token",
  accountId: "test-account-id",
  accountName: "Test Account",
  userEmail: "test@example.com",
  appId: "550e8400-e29b-41d4-a716-446655440000",
  appName: "Test App",
  apiKey: "550e8400-e29b-41d4-a716-446655440000.testkey:testsecret",
  keyId: "550e8400-e29b-41d4-a716-446655440000.testkey",
  keyName: "Test Key",
  accountAlias: "default",
} as const;

/**
 * In-memory mock implementation of ConfigManager for testing.
 * This allows tests to run without filesystem operations.
 */
export class MockConfigManager implements ConfigManager {
  private config: AblyConfig;

  constructor(initialConfig?: AblyConfig) {
    this.config = initialConfig ?? this.createDefaultConfig();
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
    } = DEFAULT_TEST_CONFIG;

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
   * Reset the config to default values.
   * Useful for test cleanup or starting fresh.
   */
  public reset(): void {
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
