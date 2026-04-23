import { AblyBaseCommand } from "./base-command.js";
import { controlApiFlags } from "./flags.js";
import { ControlApi, App } from "./services/control-api.js";
import { BaseFlags } from "./types/cli.js";
import { errorMessage } from "./utils/errors.js";
import isWebCliMode from "./utils/web-mode.js";

export abstract class ControlBaseCommand extends AblyBaseCommand {
  // Control API commands get core + hidden control API flags
  static globalFlags = { ...controlApiFlags };

  /**
   * Create a Control API instance for making requests
   */
  protected createControlApi(flags: BaseFlags): ControlApi {
    let accessToken = process.env.ABLY_ACCESS_TOKEN;

    if (!accessToken) {
      const account = this.configManager.getCurrentAccount();
      if (!account) {
        this.fail(
          `No access token provided. Please set the ABLY_ACCESS_TOKEN environment variable or configure an account with "ably accounts login".`,
          flags,
          "auth",
        );
      }

      accessToken = account.accessToken;
    }

    if (!accessToken) {
      this.fail(
        `No access token provided. Please set the ABLY_ACCESS_TOKEN environment variable or configure an account with "ably accounts login".`,
        flags,
        "auth",
      );
    }

    if (isWebCliMode() && flags["control-host"]) {
      this.fail(
        "The --control-host flag is not available in web CLI mode.",
        flags,
        "auth",
      );
    }

    return new ControlApi({
      accessToken,
      controlHost: flags["control-host"],
    });
  }

  /**
   * Resolve app ID or fail the command with a standard error.
   * Returns the app ID string — never returns null.
   */
  protected async requireAppId(flags: BaseFlags): Promise<string> {
    const appId = await this.resolveAppId(flags);
    if (!appId) {
      this.fail(
        'No app specified. Use --app flag or select an app with "ably apps switch"',
        flags,
        "app",
      );
    }
    return appId;
  }

  protected formatDate(timestamp: number): string {
    return new Date(timestamp).toISOString();
  }

  /**
   * Resolves the app ID from the flags, current configuration, or interactive prompt
   */
  protected async resolveAppId(flags: BaseFlags): Promise<string> {
    // If app is provided in flags, use it (it could be ID or name)
    if (flags.app) {
      // Try to parse as app ID or name
      return this.resolveAppIdFromNameOrId(flags.app, flags);
    }

    // Try to get from current app configuration
    const currentAppId = this.configManager.getCurrentAppId();
    if (currentAppId) {
      return currentAppId;
    }

    // No app ID found, try to prompt for it
    return this.promptForApp(flags);
  }

  /**
   * Resolves an app ID from a name or ID
   */
  protected async resolveAppIdFromNameOrId(
    appNameOrId: string,
    flags: BaseFlags = {},
  ): Promise<string> {
    const controlApi = this.createControlApi(flags);

    try {
      const apps = await controlApi.listApps();
      const matchingApp = apps.find(
        (app: App) => app.name === appNameOrId || app.id === appNameOrId,
      );

      if (matchingApp) {
        return matchingApp.id;
      }

      this.fail(
        `App "${appNameOrId}" not found. Please provide a valid app ID or name.`,
        flags,
        "app",
      );
    } catch (error) {
      this.fail(
        `Failed to look up app "${appNameOrId}": ${errorMessage(error)}`,
        flags,
        "app",
      );
    }
  }

  /**
   * Resolve an account alias or ID to the account alias.
   * Matches by alias first (exact), then by accountId (exact).
   * Returns the alias string needed by configManager methods.
   */
  protected resolveAccountAlias(aliasOrId: string, flags: BaseFlags): string {
    const accounts = this.configManager.listAccounts();

    // Try alias match first
    const byAlias = accounts.find((a) => a.alias === aliasOrId);
    if (byAlias) return byAlias.alias;

    // Try accountId match
    const byId = accounts.find((a) => a.account.accountId === aliasOrId);
    if (byId) return byId.alias;

    this.fail(
      `Account "${aliasOrId}" not found. Use "ably accounts list" to see available accounts.`,
      flags,
      "account",
      {
        availableAccounts: accounts.map(({ account, alias }) => ({
          alias,
          id: account.accountId,
          name: account.accountName,
        })),
      },
    );
  }

  /**
   * Prompts the user to select an app
   */
  protected async promptForApp(flags: BaseFlags = {}): Promise<string> {
    try {
      const controlApi = this.createControlApi(flags);
      const apps = await controlApi.listApps();

      if (apps.length === 0) {
        this.fail(
          "No apps found in your account. Please create an app first.",
          flags,
          "app",
        );
      }

      // Prompt the user to choose an app from the list
      const app = await this.interactiveHelper.selectApp(controlApi);
      if (!app) {
        this.fail("No app selected.", flags, "app");
      }

      // Save the selected app ID as the current app
      this.configManager.setCurrentApp(app.id);

      return app.id;
    } catch (error) {
      this.fail(`Failed to get apps: ${errorMessage(error)}`, flags, "app");
    }
  }

  /**
   * Run the Control API command with standard error handling.
   * Returns the result directly — never returns null.
   */
  protected async runControlCommand<T>(
    flags: BaseFlags,
    apiCall: (api: ControlApi) => Promise<T>,
    errorPrefix = "Error executing command",
  ): Promise<T> {
    try {
      // Display account info at start of command
      await this.showAuthInfoIfNeeded(flags);

      // Create API and execute the command
      const api = this.createControlApi(flags);
      return await apiCall(api);
    } catch (error: unknown) {
      this.fail(error, flags, "controlApi", {
        errorPrefix,
      });
    }
  }
}
