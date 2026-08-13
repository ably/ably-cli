import chalk from "chalk";

import { ControlBaseCommand } from "../../control-base-command.js";
import type { AccountConfig } from "../../services/config-manager.js";
import type { BaseFlags } from "../../types/cli.js";
import {
  extractAppIdFromApiKey,
  extractKeyNameFromApiKey,
} from "../../utils/api-key.js";
import { errorMessage } from "../../utils/errors.js";
import { formatLabel } from "../../utils/output.js";
import { formatEndpointUrl } from "../../utils/server-url.js";

export default class AccountsCurrent extends ControlBaseCommand {
  static override description = "Show the current Ably account";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --json",
    "<%= config.bin %> <%= command.id %> --pretty-json",
  ];

  static override flags = {
    ...ControlBaseCommand.globalFlags,
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(AccountsCurrent);

    // Special handling for web CLI mode
    if (this.isWebCliMode) {
      return this.handleWebCliMode(flags);
    }

    // Get current account alias and account object
    const currentAlias = this.configManager.getCurrentAccountAlias();
    const currentAccount = this.configManager.getCurrentAccount();

    if (!currentAlias || !currentAccount) {
      this.fail(
        'No account is currently selected. Use "ably accounts login" or "ably accounts switch" to select an account.',
        flags,
        "accountCurrent",
      );
    }

    // A local server account with no control plane has no /me endpoint to
    // verify against. Report what is stored and stop, rather than letting the
    // control-plane guard surface as an expired-token warning.
    if (
      currentAccount.authMethod === "apiKey" &&
      !this.configManager.getControlUrl()
    ) {
      this.showLocalAccount(currentAlias, flags);
      return;
    }

    // Verify the account by making an API call to get up-to-date information.
    // Route through createControlApi so OAuth accounts get the same
    // TokenRefreshMiddleware used by every other control command.
    try {
      const controlApi = this.createControlApi(flags);

      const { account, user } = await controlApi.getMe();

      // Count number of apps configured for this account
      const appCount = currentAccount.apps
        ? Object.keys(currentAccount.apps).length
        : 0;

      const { currentApp, currentKey } = this.getCurrentAppAndKey();
      const server = this.serverUrls();

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            account: {
              name: account.name,
              id: account.id,
              user: { email: user.email },
              appsConfigured: appCount,
              currentApp,
              currentKey,
              ...server.json,
            },
          },
          flags,
        );
      } else {
        this.log(
          `${formatLabel("Account")} ${chalk.cyan.bold(account.name)} ${chalk.gray(`(${account.id})`)}`,
        );
        this.log(`${formatLabel("User")} ${chalk.cyan.bold(user.email)}`);
        this.logServerUrls(server);
        this.log(
          `${formatLabel("Apps configured")} ${chalk.cyan.bold(appCount)}`,
        );

        if (currentApp) {
          this.log(
            `${formatLabel("Current App")} ${chalk.green.bold(currentApp.name)} ${chalk.gray(`(${currentApp.id})`)}`,
          );

          if (currentKey) {
            this.log(
              `${formatLabel("Current API Key")} ${chalk.yellow.bold(currentKey.id)}`,
            );
            this.log(
              `${formatLabel("Key Label")} ${chalk.yellow.bold(currentKey.label)}`,
            );
          }
        }
      }
    } catch {
      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            account: {
              cached: true,
              name: currentAccount.accountName,
              id: currentAccount.accountId,
              user: { email: currentAccount.userEmail },
              warning:
                "Unable to verify account information. Your access token may have expired.",
            },
          },
          flags,
        );
      } else {
        this.logWarning(
          "Unable to verify account information. Your access token may have expired.",
          flags,
        );
        this.log(
          chalk.yellow(
            `Consider logging in again with "${this.reloginCommand(currentAlias, currentAccount)}".`,
          ),
        );

        // Show cached information
        this.log(
          `${formatLabel("Account (cached)")} ${chalk.cyan.bold(currentAccount.accountName)}${currentAccount.accountId ? ` ${chalk.gray(`(${currentAccount.accountId})`)}` : ""}`,
        );

        if (currentAccount.userEmail) {
          this.log(
            `${formatLabel("User (cached)")} ${chalk.cyan.bold(currentAccount.userEmail)}`,
          );
        }
      }
    }
  }

  /**
   * Report a local server account from config alone.
   *
   * The alias, the server URL and the app read out of the API key are the whole
   * of what a local server tells us — there is no account directory to query,
   * so nothing here is unverified or stale.
   */
  private showLocalAccount(alias: string, flags: BaseFlags): void {
    const account = this.configManager.getCurrentAccount()!;
    const appCount = account.apps ? Object.keys(account.apps).length : 0;
    const { currentApp, currentKey } = this.getCurrentAppAndKey();
    const server = this.serverUrls();

    if (this.shouldOutputJson(flags)) {
      this.logJsonResult(
        {
          account: {
            alias,
            authMethod: "apiKey",
            name: account.accountName || alias,
            appsConfigured: appCount,
            currentApp,
            currentKey,
            ...server.json,
          },
        },
        flags,
      );
      return;
    }

    this.log(`${formatLabel("Account")} ${chalk.cyan.bold(alias)}`);
    this.logServerUrls(server);
    this.log(`${formatLabel("Apps configured")} ${chalk.cyan.bold(appCount)}`);

    if (currentApp) {
      // A local server has no control plane to resolve the name from, so the
      // ID stands alone unless a name was cached at login.
      this.log(
        currentApp.name === currentApp.id
          ? `${formatLabel("Current App")} ${chalk.green.bold(currentApp.id)}`
          : `${formatLabel("Current App")} ${chalk.green.bold(currentApp.name)} ${chalk.gray(`(${currentApp.id})`)}`,
      );

      if (currentKey) {
        this.log(
          `${formatLabel("Current API Key")} ${chalk.yellow.bold(currentKey.id)}`,
        );
        this.log(
          `${formatLabel("Key Label")} ${chalk.yellow.bold(currentKey.label)}`,
        );
      }
    }

    this.logToStderr(
      "No control plane configured — app and key management commands are unavailable for this account.",
    );
  }

  /**
   * The current app and key as stored in config, shared by every output path.
   */
  private getCurrentAppAndKey(): {
    currentApp: { id: string; name: string } | null;
    currentKey: { id: string; label: string } | null;
  } {
    const currentAppId = this.configManager.getCurrentAppId();
    if (!currentAppId) return { currentApp: null, currentKey: null };

    const currentApp = {
      id: currentAppId,
      name: this.configManager.getAppName(currentAppId) || currentAppId,
    };

    const apiKey = this.configManager.getApiKey(currentAppId);
    if (!apiKey) return { currentApp, currentKey: null };

    const keyId =
      this.configManager.getKeyId(currentAppId) ||
      extractKeyNameFromApiKey(apiKey);
    return {
      currentApp,
      currentKey: {
        id: keyId.includes(".") ? keyId : `${currentAppId}.${keyId}`,
        label: this.configManager.getKeyName(currentAppId) || "Unnamed key",
      },
    };
  }

  /**
   * The servers this account is pointed at, as URLs — the same form used by
   * `accounts list`, `accounts switch` and the "Using:" banner. Absent for a
   * managed account on Ably's own endpoints, which need no stating.
   */
  private serverUrls(): {
    controlUrl?: string;
    endpoint?: string;
    json: Record<string, unknown>;
  } {
    const dataPlane = this.configManager.getDataPlane();
    const endpoint = formatEndpointUrl(dataPlane);
    const controlUrl = this.configManager.getControlUrl();

    return {
      controlUrl,
      endpoint,
      // Same shape as `accounts login --local`, `accounts switch` and
      // `accounts list` report.
      json: {
        ...(dataPlane ? { dataPlane: { ...dataPlane, url: endpoint } } : {}),
        ...(controlUrl ? { controlUrl } : {}),
      },
    };
  }

  private logServerUrls(server: {
    controlUrl?: string;
    endpoint?: string;
  }): void {
    if (server.endpoint) {
      this.log(
        `${formatLabel("Endpoint")} ${chalk.blue.bold(server.endpoint)}`,
      );
    }

    if (server.controlUrl) {
      this.log(
        `${formatLabel("Control plane")} ${chalk.blue.bold(server.controlUrl)}`,
      );
    }
  }

  /**
   * The command that would re-establish this account's credentials. A local
   * account has no OAuth flow, so pointing it at plain `accounts login` would
   * open a browser to ably.com and abandon the local profile.
   */
  private reloginCommand(alias: string, account: AccountConfig): string {
    if (account.authMethod !== "apiKey") {
      return `ably accounts login --alias ${alias}`;
    }

    const parts = [`ably accounts login --local --alias ${alias}`];
    const endpoint = formatEndpointUrl(account);
    if (endpoint) parts.push(`--url ${endpoint}`);
    const controlUrl = this.configManager.getControlUrl();
    if (controlUrl) parts.push(`--control-url ${controlUrl}`);
    return parts.join(" ");
  }

  /**
   * Handle the command in web CLI mode by getting account info from environment
   * and using the Control API to get additional details
   */
  private async handleWebCliMode(
    flags: Record<string, unknown>,
  ): Promise<void> {
    const accessToken = process.env.ABLY_ACCESS_TOKEN;
    if (!accessToken) {
      this.fail(
        "ABLY_ACCESS_TOKEN environment variable is not set",
        flags,
        "accountCurrent",
      );
    }

    try {
      // Create a control API instance
      const controlApi = this.createControlApi(flags);

      // Get account details from the Control API
      const { account, user } = await controlApi.getMe();

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            account: {
              accountId: account.id,
              accountName: account.name,
              userEmail: user.email,
            },
            mode: "web-cli",
          },
          flags,
        );
      } else {
        // Extract app ID from ABLY_API_KEY
        const apiKey = process.env.ABLY_API_KEY;
        let appId = "";
        let keyId = "";

        if (apiKey) {
          appId = extractAppIdFromApiKey(apiKey);
          keyId = extractKeyNameFromApiKey(apiKey);
        }

        this.log(
          `${formatLabel("Account")} ${chalk.cyan.bold(account.name)} ${chalk.gray(`(${account.id})`)}`,
        );
        this.log(`${formatLabel("User")} ${chalk.cyan.bold(user.email)}`);

        if (appId && keyId) {
          this.log(
            `${formatLabel("Current App ID")} ${chalk.green.bold(appId)}`,
          );
          this.log(
            `${formatLabel("Current API Key")} ${chalk.yellow.bold(keyId)}`,
          );
        }

        this.log(
          `${formatLabel("Mode")} ${chalk.magenta.bold("Web CLI")} ${chalk.dim("(using environment variables)")}`,
        );
      }
    } catch (error) {
      // If we can't get account details, show an error message
      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            account: {
              error: errorMessage(error),
            },
            mode: "web-cli",
          },
          flags,
        );
      } else {
        this.logWarning(errorMessage(error), flags);
        this.log(
          `${formatLabel("Info")} Your access token may have expired or is invalid.`,
        );
        this.log(
          `${formatLabel("Mode")} ${chalk.magenta.bold("Web CLI")} ${chalk.dim("(using environment variables)")}`,
        );
      }
    }
  }
}
