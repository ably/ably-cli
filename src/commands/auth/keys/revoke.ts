import { Args, Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { forceFlag } from "../../../flags.js";
import { formatCapabilities } from "../../../utils/key-display.js";
import { formatLabel, formatResource } from "../../../utils/output.js";

export default class KeysRevokeCommand extends ControlBaseCommand {
  static args = {
    keyNameOrValue: Args.string({
      description:
        "Key name (APP_ID.KEY_ID), key ID, key label (e.g. Root), or full key value",
      required: true,
    }),
  };

  static description = "Revoke an API key (permanently disables the key)";

  static examples = [
    "$ ably auth keys revoke APP_ID.KEY_ID",
    '$ ably auth keys revoke Root --app "My App"',
    "$ ably auth keys revoke KEY_ID --app APP_ID",
    "$ ably auth keys revoke APP_ID.KEY_ID --force",
    "$ ably auth keys revoke APP_ID.KEY_ID --json",
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "The app ID or name (defaults to current app)",
      env: "ABLY_APP_ID",
    }),
    ...forceFlag,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(KeysRevokeCommand);

    let appId: string | undefined;
    const keyIdentifier = args.keyNameOrValue;

    if (flags.app) {
      appId = await this.resolveAppIdFromNameOrId(flags.app, flags);
    }

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
      const controlApi = this.createControlApi(flags);
      // Get the key details first to show info to the user
      const key = await controlApi.getKey(appId, keyIdentifier);

      const keyName = `${key.appId}.${key.id}`;

      if (!this.shouldOutputJson(flags)) {
        this.log(`Key to revoke:`);
        this.log(`${formatLabel("Key Name")} ${formatResource(keyName)}`);
        this.log(`${formatLabel("Key Label")} ${key.name || "Unnamed key"}`);
        this.log(`${formatLabel("Full key")} ${key.key}`);

        for (const line of formatCapabilities(
          key.capability as Record<string, string[] | string>,
        )) {
          this.log(line);
        }

        this.log("");
      }

      // In JSON mode, require --force to prevent accidental destructive actions
      if (!flags.force && this.shouldOutputJson(flags)) {
        this.fail(
          "The --force flag is required when using --json to confirm revocation",
          flags,
          "keyRevoke",
        );
      }

      if (!flags.force && !this.shouldOutputJson(flags)) {
        const confirmed = await this.interactiveHelper.confirm(
          "This will permanently revoke this key and any applications using it will stop working. Continue?",
        );

        if (!confirmed) {
          this.logWarning("Revocation cancelled.", flags);
          return;
        }
      }

      await controlApi.revokeKey(appId, key.id);

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            key: {
              keyName,
              message: "Key has been revoked",
            },
          },
          flags,
        );
      } else {
        this.logSuccessMessage(
          `Key ${formatResource(keyName)} has been revoked.`,
          flags,
        );
      }

      // Check if the revoked key is the current key for this app
      const currentKey = this.configManager.getApiKey(appId);
      if (currentKey === key.key) {
        if (this.shouldOutputJson(flags)) {
          // Auto-remove in JSON mode — key is already revoked, can't be used
          this.configManager.removeApiKey(appId);
        } else {
          const shouldRemove = await this.interactiveHelper.confirm(
            "The revoked key was your current key for this app. Remove it from configuration?",
          );

          if (shouldRemove) {
            this.configManager.removeApiKey(appId);
            this.logSuccessMessage("Key removed from configuration.", flags);
          }
        }
      }
    } catch (error) {
      this.fail(error, flags, "keyRevoke", { appId, keyIdentifier });
    }
  }
}
