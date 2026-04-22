import chalk from "chalk";

import { ControlBaseCommand } from "../../control-base-command.js";
import { errorMessage } from "../../utils/errors.js";
import { formatLabel } from "../../utils/output.js";

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

      // Show current app if one is selected
      const currentAppId = this.configManager.getCurrentAppId();
      let currentApp: { id: string; name: string } | null = null;
      let currentKey: { id: string; label: string } | null = null;

      if (currentAppId) {
        const appName =
          this.configManager.getAppName(currentAppId) || currentAppId;
        currentApp = { id: currentAppId, name: appName };

        // Show current key if one is selected
        const apiKey = this.configManager.getApiKey(currentAppId);
        if (apiKey) {
          const keyId =
            this.configManager.getKeyId(currentAppId) || apiKey.split(":")[0]!;
          const keyName =
            this.configManager.getKeyName(currentAppId) || "Unnamed key";
          const formattedKeyName = keyId.includes(".")
            ? keyId
            : `${currentAppId}.${keyId}`;
          currentKey = { id: formattedKeyName, label: keyName };
        }
      }

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
            },
          },
          flags,
        );
      } else {
        this.log(
          `${formatLabel("Account")} ${chalk.cyan.bold(account.name)} ${chalk.gray(`(${account.id})`)}`,
        );
        this.log(`${formatLabel("User")} ${chalk.cyan.bold(user.email)}`);
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
            `Consider logging in again with "ably accounts login --alias ${currentAlias}".`,
          ),
        );

        // Show cached information
        this.log(
          `${formatLabel("Account (cached)")} ${chalk.cyan.bold(currentAccount.accountName)} ${chalk.gray(`(${currentAccount.accountId})`)}`,
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
          appId = apiKey.split(".")[0]!;
          keyId = apiKey.split(":")[0]!; // This includes APP_ID.KEY_ID
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
