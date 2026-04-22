import inquirer from "inquirer";
import type { ConfigManager, AccountConfig } from "./config-manager.js";
import type { AccountSummary, App, ControlApi, Key } from "./control-api.js";

export interface InteractiveHelperOptions {
  log?: (msg: string) => void;
  logErrors?: boolean;
}

export class InteractiveHelper {
  private configManager: ConfigManager;
  private log: (msg: string) => void;
  private logErrors: boolean;

  constructor(
    configManager: ConfigManager,
    options: InteractiveHelperOptions = {},
  ) {
    this.configManager = configManager;
    this.log = options.log ?? console.log;
    this.logErrors = options.logErrors !== false; // Default to true
  }

  /**
   * Confirm an action with the user
   */
  async confirm(message: string): Promise<boolean> {
    const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
      {
        default: false,
        message,
        name: "confirmed",
        type: "confirm",
      },
    ]);

    return confirmed;
  }

  /**
   * Interactively select an account from the list of configured accounts
   */
  async selectAccount(): Promise<{
    account: AccountConfig;
    alias: string;
  } | null> {
    try {
      const accounts = this.configManager.listAccounts();
      const currentAlias = this.configManager.getCurrentAccountAlias();

      if (accounts.length === 0) {
        this.log(
          'No accounts configured. Use "ably accounts login" to add an account.',
        );
        return null;
      }

      const { selectedAccount } = await inquirer.prompt<{
        selectedAccount: { account: AccountConfig; alias: string };
      }>([
        {
          choices: accounts.map((account) => {
            const isCurrent = account.alias === currentAlias;
            const accountInfo = account.account.accountName;
            const userInfo = account.account.userEmail;
            return {
              name: `${isCurrent ? "* " : "  "}${account.alias} (${accountInfo}, ${userInfo})`,
              value: account,
            };
          }),
          message: "Select an account:",
          name: "selectedAccount",
          type: "list",
        },
      ]);

      return selectedAccount;
    } catch (error) {
      if (this.logErrors) {
        this.log(
          `Error selecting account: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return null;
    }
  }

  /**
   * Interactively select an account from API results (multi-account OAuth flow)
   */
  async selectAccountFromApi(
    accounts: AccountSummary[],
  ): Promise<AccountSummary | null> {
    try {
      if (accounts.length === 0) {
        return null;
      }

      const { selectedAccount } = (await inquirer.prompt([
        {
          choices: accounts.map((account) => ({
            name: `${account.name} (${account.id})`,
            value: account,
          })),
          message: "Select an account:",
          name: "selectedAccount",
          type: "list",
        },
      ])) as { selectedAccount: AccountSummary };

      return selectedAccount;
    } catch (error) {
      if (this.logErrors) {
        this.log(
          `Error selecting account: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return null;
    }
  }

  /**
   * Interactively select an app from the list of available apps
   */
  async selectApp(controlApi: ControlApi): Promise<App | null> {
    try {
      const apps = await controlApi.listApps();

      if (apps.length === 0) {
        this.log('No apps found. Create an app with "ably apps create" first.');
        return null;
      }

      const { selectedApp } = await inquirer.prompt<{ selectedApp: App }>([
        {
          choices: apps.map((app) => ({
            name: `${app.name} (${app.id})`,
            value: app,
          })),
          message: "Select an app:",
          name: "selectedApp",
          type: "list",
        },
      ]);

      return selectedApp;
    } catch (error) {
      if (this.logErrors) {
        this.log(
          `Error fetching apps: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return null;
    }
  }

  /**
   * Interactively select a key from the list of available keys for an app
   */
  async selectKey(controlApi: ControlApi, appId: string): Promise<Key | null> {
    try {
      const keys = await controlApi.listKeys(appId);

      if (keys.length === 0) {
        this.log("No keys found for this app.");
        return null;
      }

      const { selectedKey } = await inquirer.prompt<{ selectedKey: Key }>([
        {
          choices: keys.map((key) => ({
            name: `${key.name || "Unnamed key"} (${key.id})`,
            value: key,
          })),
          message: "Select a key:",
          name: "selectedKey",
          type: "list",
        },
      ]);

      return selectedKey;
    } catch (error) {
      if (this.logErrors) {
        this.log(
          `Error fetching keys: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return null;
    }
  }
}
