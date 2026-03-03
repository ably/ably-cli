import { Args, Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";

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
      description:
        "App ID the key belongs to (uses current app if not specified)",
      env: "ABLY_APP_ID",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(KeysGetCommand);

    // Display authentication information
    await this.showAuthInfoIfNeeded(flags);

    const controlApi = this.createControlApi(flags);

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
      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          {
            error:
              'No app specified. Please provide --app flag, include APP_ID in the key name, or switch to an app with "ably apps switch".',
            success: false,
          },
          flags,
        );
      } else {
        this.error(
          'No app specified. Please provide --app flag, include APP_ID in the key name, or switch to an app with "ably apps switch".',
        );
      }

      return;
    }

    try {
      const key = await controlApi.getKey(appId, keyIdentifier);

      if (this.shouldOutputJson(flags)) {
        // Add the full key name to the JSON output
        this.log(
          this.formatJsonOutput(
            {
              key: {
                ...key,
                keyName: `${key.appId}.${key.id}`,
              },
              success: true,
            },
            flags,
          ),
        );
      } else {
        this.log(`Key Details:\n`);

        const keyName = `${key.appId}.${key.id}`;
        this.log(`Key Name: ${keyName}`);
        this.log(`Key Label: ${key.name || "Unnamed key"}`);

        // Format the capabilities
        if (key.capability) {
          const capEntries = Object.entries(key.capability);
          if (capEntries.length === 0) {
            this.log(`Capabilities: None`);
          } else if (capEntries.length === 1) {
            const [scope, privileges] = capEntries[0];
            this.log(
              `Capabilities: ${scope} → ${Array.isArray(privileges) ? privileges.join(", ") : privileges}`,
            );
          } else {
            this.log(`Capabilities:`);
            for (const [scope, privileges] of capEntries) {
              this.log(
                `  • ${scope} → ${Array.isArray(privileges) ? privileges.join(", ") : privileges}`,
              );
            }
          }
        } else {
          this.log(`Capabilities: None`);
        }

        this.log(`Created: ${this.formatDate(key.created)}`);
        this.log(`Updated: ${this.formatDate(key.modified)}`);
        this.log(`Full key: ${key.key}`);
      }
    } catch (error) {
      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          {
            appId,
            error: error instanceof Error ? error.message : String(error),
            keyIdentifier,
            success: false,
          },
          flags,
        );
      } else {
        this.error(
          `Error getting key details: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}
