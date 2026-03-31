import chalk from "chalk";

import { ControlBaseCommand } from "../../control-base-command.js";
import { errorMessage } from "../../utils/errors.js";
import { formatLabel } from "../../utils/output.js";

export default class AppsCurrent extends ControlBaseCommand {
  static override description = "Show the currently selected app";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --json",
    "<%= config.bin %> <%= command.id %> --pretty-json",
  ];

  static override flags = {
    ...ControlBaseCommand.globalFlags,
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(AppsCurrent);

    // Special handling for web CLI mode
    if (this.isWebCliMode) {
      return this.handleWebCliMode(flags);
    }

    // Get the current account and app
    const currentAccountAlias = this.configManager.getCurrentAccountAlias();
    const currentAccount = this.configManager.getCurrentAccount();
    const currentAppId = this.configManager.getCurrentAppId();

    if (!currentAccountAlias || !currentAccount) {
      this.fail(
        'No account selected. Use "ably accounts switch" to select an account.',
        flags,
        "appCurrent",
      );
    }

    if (!currentAppId) {
      this.fail(
        'No app selected. Use "ably apps switch" to select an app.',
        flags,
        "appCurrent",
      );
    }

    // Get app name from local config
    const appName = this.configManager.getAppName(currentAppId) || currentAppId;

    try {
      if (this.shouldOutputJson(flags)) {
        // Get key information for JSON output
        const apiKey = this.configManager.getApiKey(currentAppId);
        let keyInfo = null;

        if (apiKey) {
          const keyId =
            this.configManager.getKeyId(currentAppId) || apiKey.split(":")[0]!;
          const keyLabel =
            this.configManager.getKeyName(currentAppId) || "Unnamed key";
          const keyName = keyId.includes(".")
            ? keyId
            : `${currentAppId}.${keyId.split(".")[1] ?? keyId}`;

          keyInfo = {
            keyName,
            label: keyLabel,
          };
        }

        this.logJsonResult(
          {
            app: {
              id: currentAppId,
              name: appName,
              account: { alias: currentAccountAlias, ...currentAccount },
              key: keyInfo,
            },
          },
          flags,
        );
      } else {
        this.log(
          `${formatLabel("Account")} ${chalk.cyan.bold(currentAccount.accountName || currentAccountAlias)} ${chalk.gray(`(${currentAccount.accountId || "Unknown ID"})`)}`,
        );
        this.log(
          `${formatLabel("App")} ${chalk.green.bold(appName)} ${chalk.gray(`(${currentAppId})`)}`,
        );

        // Show the currently selected API key if one is set
        const apiKey = this.configManager.getApiKey(currentAppId);
        if (apiKey) {
          // Extract the key ID and format the full key name (app_id.key_id)
          const keyId =
            this.configManager.getKeyId(currentAppId) || apiKey.split(":")[0]!;
          const keyLabel =
            this.configManager.getKeyName(currentAppId) || "Unnamed key";

          // Format the full key name (app_id.key_id)
          const keyName = keyId.includes(".")
            ? keyId
            : `${currentAppId}.${keyId.split(".")[1] ?? keyId}`;

          this.log(`${formatLabel("API Key")} ${chalk.yellow.bold(keyName)}`);
          this.log(
            `${formatLabel("Key Label")} ${chalk.yellow.bold(keyLabel)}`,
          );
        } else {
          this.log(
            `${formatLabel("API Key")} ${chalk.dim('None selected. Use "ably auth keys switch" to select a key.')}`,
          );
        }
      }
    } catch (error) {
      this.fail(error, flags, "appCurrent", {
        context: "retrieving app information",
      });
    }
  }

  /**
   * Handle the command in web CLI mode by extracting app info from environment variables
   * and using the Control API to get additional details
   */
  private async handleWebCliMode(
    flags: Record<string, unknown>,
  ): Promise<void> {
    // Extract app ID from the ABLY_API_KEY environment variable
    const apiKey = process.env.ABLY_API_KEY;
    if (!apiKey) {
      this.fail(
        "ABLY_API_KEY environment variable is not set",
        flags,
        "appCurrent",
      );
    }

    // API key format is [APP_ID].[KEY_ID]:[KEY_SECRET]
    const appId = apiKey.split(".")[0]!;
    const keyId = apiKey.split(":")[0]!; // This includes APP_ID.KEY_ID

    try {
      // Create a control API instance using the base class method
      const controlApi = this.createControlApi(flags);

      // Get app details from the Control API
      const appDetails = await controlApi.getApp(appId);

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            app: {
              id: appId,
              name: appDetails.name,
              key: { keyName: keyId, label: "Web CLI Key" },
            },
            mode: "web-cli",
          },
          flags,
        );
      } else {
        // Get account info if possible
        let accountName = "Web CLI Account";
        let accountId = "";

        try {
          const { account } = await controlApi.getMe();
          accountName = account.name;
          accountId = account.id;
        } catch {
          // If we can't get account details, just use default values
        }

        this.log(
          `${formatLabel("Account")} ${chalk.cyan.bold(accountName)} ${accountId ? chalk.gray(`(${accountId})`) : ""}`,
        );
        this.log(
          `${formatLabel("App")} ${chalk.green.bold(appDetails.name)} ${chalk.gray(`(${appId})`)}`,
        );
        this.log(`${formatLabel("API Key")} ${chalk.yellow.bold(keyId)}`);
        this.log(
          `${formatLabel("Mode")} ${chalk.magenta.bold("Web CLI")} ${chalk.dim("(using environment variables)")}`,
        );
      }
    } catch (error) {
      // If we can't get app details, just show what we know
      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            app: {
              id: appId,
              name: "Unknown",
              key: { keyName: keyId, label: "Web CLI Key" },
            },
            mode: "web-cli",
          },
          flags,
        );
      } else {
        this.log(
          `${formatLabel("App")} ${chalk.green.bold("Unknown")} ${chalk.gray(`(${appId})`)}`,
        );
        this.log(`${formatLabel("API Key")} ${chalk.yellow.bold(keyId)}`);
        this.warn(
          `Could not fetch additional app details: ${errorMessage(error)}`,
        );
        this.log(
          `${formatLabel("Mode")} ${chalk.magenta.bold("Web CLI")} ${chalk.dim("(using environment variables)")}`,
        );
      }
    }
  }
}
