import { Flags } from "@oclif/core";
import chalk from "chalk";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { formatCapabilities } from "../../../utils/key-display.js";
import {
  formatHeading,
  formatLabel,
  formatLimitWarning,
  formatResource,
} from "../../../utils/output.js";

export default class KeysListCommand extends ControlBaseCommand {
  static description = "List all keys in the app";

  static examples = [
    "$ ably auth keys list",
    "$ ably auth keys list --app APP_ID",
    "$ ably auth keys list --json",
    "$ ably auth keys list --pretty-json",
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "The app ID or name (defaults to current app)",
      env: "ABLY_APP_ID",
    }),
    limit: Flags.integer({
      default: 100,
      description: "Maximum number of results to return (default: 100)",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(KeysListCommand);

    // Get app ID from flag or current config (resolves app names to IDs)
    // Must resolve before showAuthInfoIfNeeded so --app names display correctly
    const appId = await this.requireAppId(flags);

    // Display authentication information (after app resolution so name→ID is correct)
    await this.showAuthInfoIfNeeded(flags);

    try {
      const controlApi = this.createControlApi(flags);
      const allKeys = await controlApi.listKeys(appId);
      const hasMore = allKeys.length > flags.limit;
      const keys = allKeys.slice(0, flags.limit);

      // Get the current key name for highlighting (app_id.key_Id)
      const currentKeyId = this.configManager.getKeyId(appId);
      const currentKeyName =
        currentKeyId && currentKeyId.includes(".")
          ? currentKeyId
          : currentKeyId
            ? `${appId}.${currentKeyId}`
            : undefined;

      if (this.shouldOutputJson(flags)) {
        // Add a "current" flag to the key if it's the currently selected one
        const keysWithCurrent = keys.map((key) => {
          const keyName = `${key.appId}.${key.id}`;
          return {
            ...key,
            current: keyName === currentKeyName,
            keyName, // Add the full key name
          };
        });
        this.logJsonResult(
          {
            appId,
            hasMore,
            keys: keysWithCurrent,
          },
          flags,
        );
      } else {
        if (keys.length === 0) {
          this.log("No keys found for this app");
          return;
        }

        this.log(`Found ${keys.length} keys for app ${appId}:\n`);

        for (const key of keys) {
          const keyName = `${key.appId}.${key.id}`;
          const isCurrent = keyName === currentKeyName;
          const prefix = isCurrent ? chalk.green("▶ ") : "  ";

          this.log(
            prefix +
              formatHeading(
                `${formatLabel("Key Name")} ${formatResource(keyName)}`,
              ) +
              (isCurrent ? chalk.green(" (current)") : ""),
          );
          this.log(
            `  ${formatLabel("Key Label")} ${key.name || "Unnamed key"}`,
          );

          for (const line of formatCapabilities(
            key.capability as Record<string, string[] | string>,
            "  ",
          )) {
            this.log(line);
          }

          this.log("");
        }

        if (hasMore) {
          const warning = formatLimitWarning(keys.length, flags.limit, "keys");
          if (warning) this.logToStderr(warning);
        }
      }
    } catch (error) {
      this.fail(error, flags, "keyList", { appId });
    }
  }
}
