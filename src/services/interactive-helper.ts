import { promptForSelection } from "../utils/prompt-selection.js";
import type { ConfigManager, AccountConfig } from "./config-manager.js";
import type { App, ControlApi, Key } from "./control-api.js";

export interface InteractiveHelperOptions {
  logErrors?: boolean;
}

export class InteractiveHelper {
  private configManager: ConfigManager;
  private logErrors: boolean;

  constructor(
    configManager: ConfigManager,
    options: InteractiveHelperOptions = {},
  ) {
    this.configManager = configManager;
    this.logErrors = options.logErrors !== false; // Default to true
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
        console.log(
          'No accounts configured. Use "ably accounts login" to add an account.',
        );
        return null;
      }

      const choices = accounts.map((account) => {
        const isCurrent = account.alias === currentAlias;
        const accountInfo = account.account.accountName;
        const userInfo = account.account.userEmail;
        return {
          name: `${isCurrent ? "* " : "  "}${account.alias} (${accountInfo}, ${userInfo})`,
          value: account,
        };
      });

      return await promptForSelection("Select an account:", choices);
    } catch (error) {
      if (this.logErrors) {
        console.error("Error selecting account:", error);
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
        console.log(
          'No apps found. Create an app with "ably apps create" first.',
        );
        return null;
      }

      const choices = apps.map((app) => ({
        name: `${app.name} (${app.id})`,
        value: app,
      }));

      return await promptForSelection("Select an app:", choices);
    } catch (error) {
      if (this.logErrors) {
        console.error("Error fetching apps:", error);
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
        console.log("No keys found for this app.");
        return null;
      }

      const choices = keys.map((key) => ({
        name: `${key.name || "Unnamed key"} (${key.id})`,
        value: key,
      }));

      return await promptForSelection("Select a key:", choices);
    } catch (error) {
      if (this.logErrors) {
        console.error("Error fetching keys:", error);
      }
      return null;
    }
  }
}
