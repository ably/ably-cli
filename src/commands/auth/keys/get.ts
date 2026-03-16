import { Args, Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { formatCapabilities } from "../../../utils/key-display.js";
import {
  formatHeading,
  formatLabel,
  formatProgress,
  formatResource,
  formatWarning,
} from "../../../utils/output.js";

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
      appId = await this.requireAppId(flags);
    }

    try {
      if (!this.shouldOutputJson(flags)) {
        this.log(formatProgress("Fetching key details"));
      }

      const controlApi = this.createControlApi(flags);
      const key = await controlApi.getKey(appId, keyIdentifier);

      const keyName = `${key.appId}.${key.id}`;

      // Check if env var overrides the current key
      const currentKeyId = this.configManager.getKeyId(appId);
      const currentKeyName = currentKeyId?.includes(".")
        ? currentKeyId
        : currentKeyId
          ? `${appId}.${currentKeyId}`
          : undefined;
      const envKey = process.env.ABLY_API_KEY;
      const envKeyPrefix = envKey ? envKey.split(":")[0] : undefined;
      const hasEnvOverride =
        envKey && currentKeyName === keyName && envKeyPrefix !== keyName;

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            key: {
              ...key,
              keyName,
            },
            ...(hasEnvOverride
              ? {
                  envKeyOverride: {
                    keyName: envKeyPrefix,
                    note: "ABLY_API_KEY env var overrides this key for product API commands",
                  },
                }
              : {}),
          },
          flags,
        );
      } else {
        this.log(formatHeading("Key Details"));
        this.log(`${formatLabel("Key Name")} ${formatResource(keyName)}`);
        this.log(`${formatLabel("Key Label")} ${key.name || "Unnamed key"}`);

        for (const line of formatCapabilities(
          key.capability as Record<string, string[] | string>,
        )) {
          this.log(line);
        }

        this.log(`${formatLabel("Created")} ${this.formatDate(key.created)}`);
        this.log(`${formatLabel("Updated")} ${this.formatDate(key.modified)}`);
        this.log(`${formatLabel("Full key")} ${key.key}`);

        if (hasEnvOverride) {
          this.logToStderr("");
          this.logToStderr(
            formatWarning(
              `ABLY_API_KEY environment variable is set to a different key (${envKeyPrefix}). ` +
                `The env var overrides this key for product API commands.`,
            ),
          );
        }
      }
    } catch (error) {
      this.fail(error, flags, "keyGet", { appId, keyIdentifier });
    }
  }
}
