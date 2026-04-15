import { Flags } from "@oclif/core";
import chalk from "chalk";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { formatLabel } from "../../../utils/output.js";

export default class KeysCurrentCommand extends ControlBaseCommand {
  static description = "Show the current API key for the selected app";

  static examples = [
    "$ ably auth keys current",
    "$ ably auth keys current --app APP_ID",
    "$ ably auth keys current --json",
    "$ ABLY_API_KEY=$(ably auth keys current --value-only) node my-script.js",
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "The app ID (defaults to current app)",
      env: "ABLY_APP_ID",
    }),
    "value-only": Flags.boolean({
      description:
        "Output only the raw API key value, useful for scripting and environment variables",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(KeysCurrentCommand);

    // Special handling for web CLI mode
    if (this.isWebCliMode) {
      return this.handleWebCliMode(flags);
    }

    // Get app ID from flag or current config
    const appId = flags.app || this.configManager.getCurrentAppId();

    if (!appId) {
      this.fail(
        'No app specified. Please provide --app flag or switch to an app with "ably apps switch".',
        flags,
        "KeyCurrent",
      );
    }

    // Get the current key for this app
    const apiKey = this.configManager.getApiKey(appId);

    if (!apiKey) {
      this.fail(
        `No API key configured for app ${appId}. Use "ably auth keys switch" to select a key.`,
        flags,
        "KeyCurrent",
      );
    }

    // --value-only: output just the raw API key string, nothing else
    if (flags["value-only"]) {
      this.log(apiKey);
      return;
    }

    // Extract the key ID (part before the colon)
    const keyId = this.configManager.getKeyId(appId) || apiKey.split(":")[0];
    const keyLabel = this.configManager.getKeyName(appId) || "Unnamed key";
    const appName = this.configManager.getAppName(appId) || appId;

    // Format the full key name (app_id.key_id)
    const keyName = keyId.includes(".")
      ? keyId
      : `${appId}.${keyId.split(".")[1] || keyId}`;

    if (this.shouldOutputJson(flags)) {
      this.logJsonResult(
        {
          app: {
            id: appId,
            name: appName,
          },
          key: {
            id: keyName,
            label: keyLabel,
            value: apiKey,
          },
        },
        flags,
      );
    } else {
      const currentAccount = this.configManager.getCurrentAccount();
      const currentAccountAlias = this.configManager.getCurrentAccountAlias();

      this.log(
        `${formatLabel("Account")} ${chalk.cyan.bold(currentAccount?.accountName || currentAccountAlias)} ${chalk.gray(`(${currentAccount?.accountId || "Unknown ID"})`)}`,
      );
      this.log(
        `${formatLabel("App")} ${chalk.green.bold(appName)} ${chalk.gray(`(${appId})`)}`,
      );
      this.log(`${formatLabel("API Key")} ${chalk.yellow.bold(keyName)}`);
      this.log(`${formatLabel("Key Value")} ${chalk.yellowBright(apiKey)}`);
      this.log(`${formatLabel("Key Label")} ${chalk.yellow.bold(keyLabel)}`);
    }
  }

  /**
   * Handle the command in web CLI mode by extracting API key from environment variables
   */
  private async handleWebCliMode(
    flags: Record<string, unknown>,
  ): Promise<void> {
    // Extract API key from environment variable
    const apiKey = process.env.ABLY_API_KEY;
    if (!apiKey) {
      this.fail(
        "ABLY_API_KEY environment variable is not set",
        flags,
        "KeyCurrent",
      );
    }

    // Parse components from the API key
    const appId = apiKey.split(".")[0];
    const keyComponents = apiKey.split(":")[0].split(".");
    const keyId = keyComponents.length > 1 ? keyComponents[1] : null;
    const keyName = `${appId}.${keyId || ""}`;

    if (this.shouldOutputJson(flags)) {
      this.logJsonResult(
        {
          app: {
            id: appId,
          },
          key: {
            id: keyName,
            label: "Web CLI Key",
            value: apiKey,
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
        const controlApi = this.createControlApi(flags);
        const { account } = await controlApi.getMe();
        accountName = account.name;
        accountId = account.id;
      } catch {
        // If we can't get account details, just use default values
      }

      this.log(
        `${formatLabel("Account")} ${chalk.cyan.bold(accountName)} ${accountId ? chalk.gray(`(${accountId})`) : ""}`,
      );
      this.log(`${formatLabel("App")} ${chalk.green.bold(appId)}`);
      this.log(`${formatLabel("API Key")} ${chalk.yellow.bold(keyName)}`);
      this.log(`${formatLabel("Key Value")} ${chalk.yellowBright(apiKey)}`);
      this.log(
        `${formatLabel("Mode")} ${chalk.magenta.bold("Web CLI")} ${chalk.dim("(using environment variables)")}`,
      );
    }
  }
}
