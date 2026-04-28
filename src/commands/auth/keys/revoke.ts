import { Args } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { forceFlag } from "../../../flags.js";
import { formatCapabilities } from "../../../utils/key-display.js";
import { formatLabel, formatResource } from "../../../utils/output.js";

export default class KeysRevokeCommand extends ControlBaseCommand {
  static args = {
    keyNameOrValue: Args.string({
      description:
        'Key name "<APP_ID>.<KEY_ID>" or value "<APP_ID>.<KEY_ID>:<KEY_SECRET>"',
      required: true,
    }),
  };

  static description = "Revoke an API key (permanently disables the key)";

  static examples = [
    '$ ably auth keys revoke "APP_ID.KEY_ID"',
    '$ ably auth keys revoke "APP_ID.KEY_ID:KEY_SECRET"',
    '$ ably auth keys revoke "APP_ID.KEY_ID" --force',
    '$ ably auth keys revoke "APP_ID.KEY_ID" --json',
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,
    ...forceFlag,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(KeysRevokeCommand);

    const keyIdentifier = args.keyNameOrValue;

    // Extract appId from the key identifier (key name or key value)
    const appId = this.resolveAppIdForKey(keyIdentifier, flags);

    try {
      const controlApi = this.createControlApi(flags);
      // Get the key details first to show info to the user
      const fullKeyObject = await controlApi.getKey(appId, keyIdentifier);

      const keyName = `${fullKeyObject.appId}.${fullKeyObject.id}`;

      if (!this.shouldOutputJson(flags)) {
        this.log(`Key to revoke:`);
        this.log(`${formatLabel("Key Name")} ${formatResource(keyName)}`);
        this.log(
          `${formatLabel("Key Label")} ${fullKeyObject.name || "Unnamed key"}`,
        );
        this.log(`${formatLabel("Full key")} ${fullKeyObject.key}`);

        for (const line of formatCapabilities(
          fullKeyObject.capability as Record<string, string[] | string>,
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

      await controlApi.revokeKey(appId, fullKeyObject.id);

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
      if (currentKey === fullKeyObject.key) {
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
