import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse, stringify } from "smol-toml";
import isTestMode from "../utils/test-mode.js";
import { DEFAULT_OAUTH_HOST } from "./oauth-client.js";

// Updated to include key and app metadata
export interface AppConfig {
  apiKey?: string;
  appName?: string;
  keyId?: string;
  keyName?: string;
}

export interface AccountConfig {
  // Legacy: pre-OAuth configs store the access token directly on the account.
  // OAuth accounts use oauthSessionKey to reference a shared OAuthSession instead.
  // Do not remove — needed for backward compatibility with existing configs.
  accessToken?: string;
  accessTokenExpiresAt?: number;
  accountId: string;
  accountName: string;
  apps?: {
    [appId: string]: AppConfig;
  };
  authMethod?: "oauth";
  controlHost?: string;
  currentAppId?: string;
  endpoint?: string;
  // OAuth authorization server host (ably.com or a review-app override).
  // Kept separate from controlHost so the session key and token-refresh
  // traffic always targets the host that actually minted the tokens.
  oauthHost?: string;
  oauthSessionKey?: string;
  tokenId?: string;
  userEmail: string;
}

export interface OAuthSession {
  accessToken: string;
  accessTokenExpiresAt: number;
  oauthScope?: string;
  refreshToken: string;
}

export interface AblyConfig {
  accounts: Record<string, AccountConfig>;
  current?: {
    account?: string;
  };
  helpContext?: {
    conversation: {
      messages: {
        content: string;
        role: "assistant" | "user";
      }[];
    };
  };
  oauthSessions?: Record<string, OAuthSession>;
}

export interface ConfigManager {
  // Account management
  getAccessToken(): string | undefined;
  getCurrentAccount(): AccountConfig | undefined;
  getCurrentAccountAlias(): string | undefined;
  listAccounts(): { account: AccountConfig; alias: string }[];
  storeAccount(
    accessToken: string,
    alias: string,
    accountInfo: {
      accountId: string;
      accountName: string;
      tokenId?: string;
      userEmail: string;
    },
  ): void;
  switchAccount(alias: string): boolean;
  removeAccount(alias: string): boolean;

  // OAuth management
  storeOAuthTokens(
    alias: string,
    tokens: {
      accessToken: string;
      refreshToken: string;
      expiresAt: number;
      scope?: string;
      userEmail?: string;
    },
    accountInfo?: {
      accountId?: string;
      accountName?: string;
      controlHost?: string;
      oauthHost?: string;
    },
  ): void;
  getOAuthTokens(alias?: string):
    | {
        accessToken: string;
        refreshToken: string;
        expiresAt: number;
      }
    | undefined;
  isAccessTokenExpired(): boolean;
  getAuthMethod(alias?: string): "oauth" | undefined;
  getAliasesForOAuthSession(alias: string): string[];
  clearOAuthSession(alias?: string): void;

  // App management
  getApiKey(appId?: string): string | undefined;
  getAppName(appId: string): string | undefined;
  getAppConfig(appId: string): AppConfig | undefined;
  getCurrentAppId(): string | undefined;
  getKeyId(appId?: string): string | undefined;
  getKeyName(appId?: string): string | undefined;
  setCurrentApp(appId: string): void;
  storeAppInfo(
    appId: string,
    appInfo: { appName: string },
    accountAlias?: string,
  ): void;
  storeAppKey(
    appId: string,
    apiKey: string,
    metadata?: { appName?: string; keyId?: string; keyName?: string },
    accountAlias?: string,
  ): void;
  removeApiKey(appId: string): boolean;

  // Endpoint management
  getEndpoint(alias?: string): string | undefined;
  storeEndpoint(endpoint: string, alias?: string): void;

  // Help context (AI conversation)
  getHelpContext():
    | {
        conversation: {
          messages: {
            content: string;
            role: "assistant" | "user";
          }[];
        };
      }
    | undefined;
  storeHelpContext(question: string, answer: string): void;
  clearHelpContext(): void;

  // Config file
  getConfigPath(): string;
  saveConfig(): void;
  reloadConfig(): void;
}

// Type declaration for test mocks available on globalThis
declare global {
  var __TEST_MOCKS__:
    | { configManager?: ConfigManager; [key: string]: unknown }
    | undefined;
}

/**
 * Factory function to create a ConfigManager instance.
 * In test mode (when ABLY_CLI_TEST_MODE is set and mock is available),
 * returns the MockConfigManager from globals.
 * Otherwise returns a new TomlConfigManager.
 */
export function createConfigManager(): ConfigManager {
  // Check if we're in test mode and have a mock available
  if (isTestMode() && globalThis.__TEST_MOCKS__?.configManager) {
    return globalThis.__TEST_MOCKS__.configManager;
  }

  // Default to TomlConfigManager for production use
  return new TomlConfigManager();
}

export class TomlConfigManager implements ConfigManager {
  private config: AblyConfig = {
    accounts: {},
  };

  private configDir: string;
  private configPath: string;

  constructor() {
    // Determine config directory: Use ABLY_CLI_CONFIG_DIR env var if set, otherwise default
    const customConfigDir = process.env.ABLY_CLI_CONFIG_DIR;
    this.configDir = customConfigDir || path.join(os.homedir(), ".ably");

    // Define the config file path within the determined directory
    this.configPath = path.join(this.configDir, "config");

    // Ensure the directory exists and load the configuration
    this.ensureConfigDirExists();
    this.loadConfig();
  }

  // Clear conversation context
  public clearHelpContext(): void {
    delete this.config.helpContext;
    this.saveConfig();
  }

  public getAccessToken(): string | undefined {
    const account = this.getCurrentAccount();
    if (!account) return undefined;

    // OAuth accounts read from the shared session
    const session = account.oauthSessionKey
      ? this.config.oauthSessions?.[account.oauthSessionKey]
      : undefined;
    if (session) return session.accessToken;

    // Fallback: pre-OAuth configs store the token directly on the account
    return account.accessToken;
  }

  // Get API key for current app or specific app ID
  public getApiKey(appId?: string): string | undefined {
    const currentAccount = this.getCurrentAccount();
    if (!currentAccount || !currentAccount.apps) {
      // Fallback to environment variable if no config available
      return process.env.ABLY_API_KEY;
    }

    const targetAppId = appId || this.getCurrentAppId();
    if (!targetAppId) {
      // Fallback to environment variable if no current app
      return process.env.ABLY_API_KEY;
    }

    // Return configured API key or fallback to environment variable
    return currentAccount.apps[targetAppId]?.apiKey || process.env.ABLY_API_KEY;
  }

  // Get app name for specific app ID
  public getAppName(appId: string): string | undefined {
    const currentAccount = this.getCurrentAccount();
    if (!currentAccount || !currentAccount.apps) return undefined;

    return currentAccount.apps[appId]?.appName;
  }

  // Get full app configuration for specific app ID
  public getAppConfig(appId: string): AppConfig | undefined {
    const currentAccount = this.getCurrentAccount();
    if (!currentAccount || !currentAccount.apps) return undefined;

    const cfg = currentAccount.apps[appId];
    return cfg ? { ...cfg } : undefined;
  }

  // Get endpoint for the current account or specific alias
  public getEndpoint(alias?: string): string | undefined {
    if (alias) {
      return this.config.accounts[alias]?.endpoint;
    }

    const currentAccount = this.getCurrentAccount();
    return currentAccount?.endpoint;
  }

  // Get path to config file
  public getConfigPath(): string {
    return this.configPath;
  }

  // Get the current account configuration
  public getCurrentAccount(): AccountConfig | undefined {
    const currentAlias = this.getCurrentAccountAlias();
    if (!currentAlias) return undefined;

    return this.config.accounts[currentAlias];
  }

  // Get the current account alias
  public getCurrentAccountAlias(): string | undefined {
    return this.config.current?.account;
  }

  // Get current app ID for the current account
  public getCurrentAppId(): string | undefined {
    const currentAccount = this.getCurrentAccount();
    if (!currentAccount) return undefined;

    return currentAccount.currentAppId;
  }

  // Get conversation context for AI help
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

  // Get key ID for the current app or specific app ID
  public getKeyId(appId?: string): string | undefined {
    const currentAccount = this.getCurrentAccount();
    if (!currentAccount || !currentAccount.apps) return undefined;

    const targetAppId = appId || this.getCurrentAppId();
    if (!targetAppId) return undefined;

    // Get from specific metadata field or extract from API key
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

  // Get key name for the current app or specific app ID
  public getKeyName(appId?: string): string | undefined {
    const currentAccount = this.getCurrentAccount();
    if (!currentAccount || !currentAccount.apps) return undefined;

    const targetAppId = appId || this.getCurrentAppId();
    if (!targetAppId) return undefined;

    return currentAccount.apps[targetAppId]?.keyName;
  }

  // List all accounts
  public listAccounts(): { account: AccountConfig; alias: string }[] {
    return Object.entries(this.config.accounts).map(([alias, account]) => ({
      account,
      alias,
    }));
  }

  // Remove an account
  public removeAccount(alias: string): boolean {
    const account = this.config.accounts[alias];
    if (!account) {
      return false;
    }

    const sessionKey = account.oauthSessionKey;
    delete this.config.accounts[alias];

    // Clean up orphaned OAuth session entry
    if (sessionKey && this.config.oauthSessions?.[sessionKey]) {
      const stillReferenced = Object.values(this.config.accounts).some(
        (a) => a.oauthSessionKey === sessionKey,
      );
      if (!stillReferenced) {
        delete this.config.oauthSessions[sessionKey];
        if (Object.keys(this.config.oauthSessions).length === 0) {
          delete this.config.oauthSessions;
        }
      }
    }

    // If the removed account was the current one, clear the current account selection
    if (this.config.current?.account === alias) {
      delete this.config.current.account;
    }

    this.saveConfig();
    return true;
  }

  public getAliasesForOAuthSession(alias: string): string[] {
    const account = this.config.accounts[alias];
    if (!account?.oauthSessionKey) return [alias];

    const sessionKey = account.oauthSessionKey;
    return Object.entries(this.config.accounts)
      .filter(([, acc]) => acc.oauthSessionKey === sessionKey)
      .map(([a]) => a);
  }

  // Remove API key for an app
  public removeApiKey(appId: string): boolean {
    const currentAccount = this.getCurrentAccount();
    if (!currentAccount || !currentAccount.apps) return false;

    if (currentAccount.apps[appId]) {
      delete currentAccount.apps[appId].apiKey;
      this.saveConfig();
      return true;
    }

    return false;
  }

  public saveConfig(): void {
    try {
      // Format the config as TOML using smol-toml stringify
      const tomlContent = stringify(this.config);

      // Write the config to disk
      fs.writeFileSync(this.configPath, tomlContent, { mode: 0o600 }); // Secure file permissions
    } catch (error) {
      throw new Error(`Failed to save Ably config: ${String(error)}`, {
        cause: error,
      });
    }
  }

  // Re-read config from disk, discarding in-memory state. Used by the token
  // refresh path to detect whether a concurrent CLI invocation has rotated
  // tokens since we loaded them — otherwise we could clobber valid peer
  // tokens with our stale snapshot.
  public reloadConfig(): void {
    this.loadConfig();
  }

  // Set current app for the current account
  public setCurrentApp(appId: string): void {
    const currentAccount = this.getCurrentAccount();
    const currentAlias = this.getCurrentAccountAlias();

    if (!currentAccount || !currentAlias) {
      throw new Error("No current account selected");
    }

    // Set the current app for this account
    this.config.accounts[currentAlias]!.currentAppId = appId;
    this.saveConfig();
  }

  // Store account information
  public storeAccount(
    accessToken: string,
    alias: string = "default",
    accountInfo: {
      accountId: string;
      accountName: string;
      tokenId?: string;
      userEmail: string;
    },
  ): void {
    const existing = this.config.accounts[alias];
    this.config.accounts[alias] = {
      accessToken,
      accountId: accountInfo.accountId,
      accountName: accountInfo.accountName,
      userEmail: accountInfo.userEmail,
      tokenId: accountInfo.tokenId,
      apps: existing?.apps || {},
      currentAppId: existing?.currentAppId,
    };

    // Set as current account if it's the first one or no current account is set
    if (!this.config.current || !this.config.current.account) {
      this.config.current = { account: alias };
    }

    this.saveConfig();
  }

  // Store endpoint for the current account or specific alias
  public storeEndpoint(endpoint: string, alias?: string): void {
    const targetAlias = alias || this.getCurrentAccountAlias() || "default";

    if (!this.config.accounts[targetAlias]) {
      throw new Error(`Account "${targetAlias}" not found`);
    }

    this.config.accounts[targetAlias].endpoint = endpoint;
    this.saveConfig();
  }

  // Store app information (like name) in the config
  public storeAppInfo(
    appId: string,
    appInfo: { appName: string },
    accountAlias?: string,
  ): void {
    const alias = accountAlias || this.getCurrentAccountAlias() || "default";

    // Ensure the account and apps structure exists
    if (!this.config.accounts[alias]) {
      throw new Error(`Account "${alias}" not found`);
    }

    if (!this.config.accounts[alias].apps) {
      this.config.accounts[alias].apps = {};
    }

    // Store the app info
    this.config.accounts[alias].apps[appId] = {
      ...this.config.accounts[alias].apps[appId],
      ...appInfo,
    };

    this.saveConfig();
  }

  // Updated storeAppKey to include key metadata
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

    // Ensure the account and apps structure exists
    if (!this.config.accounts[alias]) {
      throw new Error(`Account "${alias}" not found`);
    }

    if (!this.config.accounts[alias].apps) {
      this.config.accounts[alias].apps = {};
    }

    // Store the API key and metadata
    this.config.accounts[alias].apps[appId] = {
      ...this.config.accounts[alias].apps[appId],
      apiKey,
      appName: metadata?.appName,
      keyId: metadata?.keyId || apiKey.split(":")[0], // Extract key ID if not provided
      keyName: metadata?.keyName,
    };

    this.saveConfig();
  }

  // Store conversation context for AI help
  public storeHelpContext(question: string, answer: string): void {
    if (!this.config.helpContext) {
      this.config.helpContext = {
        conversation: {
          messages: [],
        },
      };
    }

    // Add the user's question
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

    this.saveConfig();
  }

  // Store OAuth tokens, shared across aliases with the same userEmail + oauthHost.
  // userEmail is supplied by callers from the /me response (fresh login) or from
  // the previously-stored account metadata (token refresh, account switch) — it
  // is never populated from the OAuth token response, which is RFC 6749 plain.
  public storeOAuthTokens(
    alias: string,
    tokens: {
      accessToken: string;
      refreshToken: string;
      expiresAt: number;
      scope?: string;
      userEmail?: string;
    },
    accountInfo?: {
      accountId?: string;
      accountName?: string;
      controlHost?: string;
      oauthHost?: string;
    },
  ): void {
    const userEmail =
      tokens.userEmail ?? this.config.accounts[alias]?.userEmail ?? "";
    const oauthHost =
      accountInfo?.oauthHost ??
      this.config.accounts[alias]?.oauthHost ??
      DEFAULT_OAUTH_HOST;
    const emailPart = userEmail.toLowerCase() || alias;
    // Scope the session key by OAuth host so the same email on prod and a
    // review app don't silently overwrite each other's refresh tokens — the
    // issuer is the host that actually minted them.
    const sessionKey = `${emailPart}::${oauthHost.toLowerCase()}`;

    // Create/update the shared OAuth session
    if (!this.config.oauthSessions) {
      this.config.oauthSessions = {};
    }

    // Clean up the previous session entry if this account's key is changing
    // (e.g. migration from a pre-oauthHost key format).
    const previousSessionKey = this.config.accounts[alias]?.oauthSessionKey;
    if (
      previousSessionKey &&
      previousSessionKey !== sessionKey &&
      this.config.oauthSessions[previousSessionKey]
    ) {
      const stillReferenced = Object.entries(this.config.accounts).some(
        ([otherAlias, acc]) =>
          otherAlias !== alias && acc.oauthSessionKey === previousSessionKey,
      );
      if (!stillReferenced) {
        delete this.config.oauthSessions[previousSessionKey];
      }
    }

    this.config.oauthSessions[sessionKey] = {
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: tokens.expiresAt,
      oauthScope: tokens.scope,
      refreshToken: tokens.refreshToken,
    };

    // Store account metadata and reference the OAuth session
    this.config.accounts[alias] = {
      ...this.config.accounts[alias],
      accountId:
        accountInfo?.accountId ?? this.config.accounts[alias]?.accountId ?? "",
      accountName:
        accountInfo?.accountName ??
        this.config.accounts[alias]?.accountName ??
        "",
      apps: this.config.accounts[alias]?.apps || {},
      authMethod: "oauth",
      controlHost:
        accountInfo?.controlHost ?? this.config.accounts[alias]?.controlHost,
      currentAppId: this.config.accounts[alias]?.currentAppId,
      oauthHost:
        accountInfo?.oauthHost ?? this.config.accounts[alias]?.oauthHost,
      oauthSessionKey: sessionKey,
      userEmail,
    };

    // Purge legacy pre-OAuth fields that the spread above may have carried
    // over. They are inert for OAuth accounts but leave a stale plaintext
    // token in the on-disk config.
    delete this.config.accounts[alias].accessToken;
    delete this.config.accounts[alias].accessTokenExpiresAt;
    delete this.config.accounts[alias].tokenId;

    if (!this.config.current || !this.config.current.account) {
      this.config.current = { account: alias };
    }

    this.saveConfig();
  }

  // Get OAuth tokens for the current account or specific alias
  public getOAuthTokens(alias?: string):
    | {
        accessToken: string;
        refreshToken: string;
        expiresAt: number;
      }
    | undefined {
    const account = alias
      ? this.config.accounts[alias]
      : this.getCurrentAccount();
    if (!account || account.authMethod !== "oauth") return undefined;

    const session = account.oauthSessionKey
      ? this.config.oauthSessions?.[account.oauthSessionKey]
      : undefined;
    if (!session) return undefined;

    return {
      accessToken: session.accessToken,
      expiresAt: session.accessTokenExpiresAt,
      refreshToken: session.refreshToken,
    };
  }

  public isAccessTokenExpired(): boolean {
    const account = this.getCurrentAccount();
    if (!account) return false;

    // OAuth accounts read expiry from the shared session;
    // falls back to account-level field for pre-OAuth configs
    const session = account.oauthSessionKey
      ? this.config.oauthSessions?.[account.oauthSessionKey]
      : undefined;
    const expiresAt =
      session?.accessTokenExpiresAt ?? account.accessTokenExpiresAt;
    if (!expiresAt) return false;

    return Date.now() >= expiresAt - 60_000;
  }

  // Get the auth method for the current account or specific alias
  public getAuthMethod(alias?: string): "oauth" | undefined {
    const account = alias
      ? this.config.accounts[alias]
      : this.getCurrentAccount();
    return account?.authMethod;
  }

  // Switch to a different account
  public switchAccount(alias: string): boolean {
    if (!this.config.accounts[alias]) {
      return false;
    }

    if (!this.config.current) {
      this.config.current = {};
    }

    this.config.current.account = alias;
    this.saveConfig();
    return true;
  }

  // Clear OAuth session(s) for an alias without removing the account itself.
  // Used when a refresh token has been invalidated server-side — subsequent
  // commands should surface "please re-login" immediately rather than
  // re-attempting refresh against a dead token.
  public clearOAuthSession(alias?: string): void {
    const targetAlias = alias ?? this.config.current?.account;
    if (!targetAlias) return;
    const account = this.config.accounts[targetAlias];
    if (!account) return;

    const sessionKey = account.oauthSessionKey;
    if (sessionKey && this.config.oauthSessions?.[sessionKey]) {
      const stillReferenced = Object.entries(this.config.accounts).some(
        ([otherAlias, acc]) =>
          otherAlias !== targetAlias && acc.oauthSessionKey === sessionKey,
      );
      if (!stillReferenced) {
        delete this.config.oauthSessions[sessionKey];
        if (Object.keys(this.config.oauthSessions).length === 0) {
          delete this.config.oauthSessions;
        }
      }
    }

    delete account.oauthSessionKey;
    delete account.accessToken;
    delete account.accessTokenExpiresAt;

    this.saveConfig();
  }

  private ensureConfigDirExists(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { mode: 0o700 }); // Secure permissions
    }
  }

  private loadConfig(): void {
    if (fs.existsSync(this.configPath)) {
      try {
        const configContent = fs.readFileSync(this.configPath, "utf8");
        // Parse returns unknown shape — accounts may be absent in fresh configs
        const parsed = parse(configContent) as unknown as Partial<AblyConfig>;
        this.config = {
          ...parsed,
          accounts: parsed.accounts ?? {},
        };

        // Migrate old config format if needed - move app from current to account.currentAppId
        const legacyCurrent = this.config.current as
          | (typeof this.config.current & { app?: string })
          | undefined;
        if (legacyCurrent?.app) {
          const currentAccountAlias = this.config.current?.account;
          if (
            currentAccountAlias &&
            this.config.accounts[currentAccountAlias]
          ) {
            this.config.accounts[currentAccountAlias].currentAppId =
              legacyCurrent.app;
            delete legacyCurrent.app; // Remove from current section
            this.saveConfig(); // Save the migrated config
          }
        }
      } catch (error) {
        throw new Error(`Failed to load Ably config: ${String(error)}`, {
          cause: error,
        });
      }
    }
  }
}
