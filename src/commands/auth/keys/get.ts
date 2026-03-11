import { Args, Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { formatCapabilities } from "../../../utils/key-display.js";

export default class KeysGetCommand extends ControlBaseCommand {
  static args = {
    keyNameOrValue: Args.string({
      description:
        "Key name (APP_ID.KEY_ID), key ID, key label (e.g. Root), or full key value to get details for",
      required: true,
    }),
  };

  static description = "Get details for a specific key";

  static examples = [
    "$ ably auth keys get APP_ID.KEY_ID",
    "$ ably auth keys get Root --app APP_ID",
    "$ ably auth keys get KEY_ID --app APP_ID",
    "$ ably auth keys get APP_ID.KEY_ID --json",
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "The app ID or name (defaults to current app)",
      env: "ABLY_APP_ID",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(KeysGetCommand);

    // Display authentication information
    await this.showAuthInfoIfNeeded(flags);

    let appId = flags.app || this.configManager.getCurrentAppId();
    const keyIdentifier = args.keyNameOrValue;

    // If keyNameOrValue is in APP_ID.KEY_ID format (one period, no colon), extract appId.
    // Only attempt this when no appId is already known (from --app flag or current app),
    // to avoid misinterpreting labels containing periods (e.g. "v1.0") as APP_ID.KEY_ID.
    // When appId IS known, the full identifier is passed to getKey() which matches by
    // label, key ID, APP_ID.KEY_ID format, or full key value.
    if (!appId && keyIdentifier.includes(".") && !keyIdentifier.includes(":")) {
      const parts = keyIdentifier.split(".");
      if (parts.length === 2) {
        appId = parts[0];
      }
    }

    if (!appId) {
      this.fail(
        'No app specified. Please provide --app flag, include APP_ID in the key name, or switch to an app with "ably apps switch".',
        flags,
        "KeyGet",
      );
    }

    try {
      const controlApi = this.createControlApi(flags);
      const key = await controlApi.getKey(appId, keyIdentifier);

      if (this.shouldOutputJson(flags)) {
        // Add the full key name to the JSON output
        this.logJsonResult(
          {
            key: {
              ...key,
              keyName: `${key.appId}.${key.id}`,
            },
          },
          flags,
        );
      } else {
        this.log(`Key Details:\n`);

        const keyName = `${key.appId}.${key.id}`;
        this.log(`Key Name: ${keyName}`);
        this.log(`Key Label: ${key.name || "Unnamed key"}`);

        for (const line of formatCapabilities(
          key.capability as Record<string, string[] | string>,
        )) {
          this.log(line);
        }

        this.log(`Created: ${this.formatDate(key.created)}`);
        this.log(`Updated: ${this.formatDate(key.modified)}`);
        this.log(`Full key: ${key.key}`);
      }
    } catch (error) {
      this.fail(error, flags, "KeyGet", { appId, keyIdentifier });
    }
  }
}
