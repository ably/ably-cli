import { AblyBaseCommand } from "./base-command.js";
import { controlApiFlags } from "./flags.js";
import { ControlApi, App } from "./services/control-api.js";
import { OAuthClient } from "./services/oauth-client.js";
import { TokenRefreshMiddleware } from "./services/token-refresh-middleware.js";
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
    let tokenRefreshMiddleware: TokenRefreshMiddleware | undefined;

    if (!accessToken) {
      const account = this.configManager.getCurrentAccount();
      if (!account) {
        this.fail(
          `No access token provided. Please set the ABLY_ACCESS_TOKEN environment variable or configure an account with "ably accounts login".`,
          flags,
          "auth",
        );
      }

      accessToken = this.configManager.getAccessToken();

      // Set up token refresh middleware for OAuth accounts.
      // The OAuth issuer is an immutable property of the token — only the host
      // that minted it can refresh it. Prefer the stored controlHost so a
      // --control-host override (intended for control-plane routing) does not
      // silently direct refresh traffic at the wrong authorization server,
      // which would return invalid_grant and wipe a valid session.
      if (this.configManager.getAuthMethod() === "oauth") {
        const oauthHost = account.controlHost ?? flags["control-host"];
        const oauthClient = new OAuthClient({
          controlHost: oauthHost,
        });
        tokenRefreshMiddleware = new TokenRefreshMiddleware(
          this.configManager,
          oauthClient,
        );
      }
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
      tokenRefreshMiddleware,
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
