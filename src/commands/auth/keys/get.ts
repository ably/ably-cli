import { Args } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { formatCapabilities } from "../../../utils/key-display.js";
import { resolveCurrentKeyName } from "../../../utils/key-parsing.js";
import {
  formatHeading,
  formatLabel,
  formatResource,
} from "../../../utils/output.js";

export default class KeysGetCommand extends ControlBaseCommand {
  static args = {
    keyNameOrValue: Args.string({
      description:
        'Key name "<APP_ID>.<KEY_ID>" or value "<APP_ID>.<KEY_ID>:<KEY_SECRET>"',
      required: true,
    }),
  };

  static description = "Get details for a specific key";

  static examples = [
    '$ ably auth keys get "APP_ID.KEY_ID"',
    '$ ably auth keys get "APP_ID.KEY_ID:KEY_SECRET"',
    '$ ably auth keys get "APP_ID.KEY_ID" --json',
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(KeysGetCommand);

    const keyIdentifier = args.keyNameOrValue;

    // Extract appId from the key identifier (key name or key value)
    const appId = this.resolveAppIdForKey(keyIdentifier, flags);

    // Display authentication information (after app resolution so name→ID is correct)
    await this.showAuthInfoIfNeeded(flags);

    try {
      this.logProgress("Fetching key details", flags);

      const controlApi = this.createControlApi(flags);
      const fullKeyObject = await controlApi.getKey(appId, keyIdentifier);

      const keyName = `${fullKeyObject.appId}.${fullKeyObject.id}`;

      // Check if env var overrides the current key
      const currentKeyId = this.configManager.getKeyId(appId);
      const currentKeyName = resolveCurrentKeyName(appId, currentKeyId);
      const envKey = process.env.ABLY_API_KEY;
      const envKeyPrefix = envKey ? envKey.split(":")[0] : undefined;
      const hasEnvOverride =
        envKey && currentKeyName === keyName && envKeyPrefix !== keyName;

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            key: {
              ...fullKeyObject,
              created: new Date(fullKeyObject.created).toISOString(),
              modified: new Date(fullKeyObject.modified).toISOString(),
              keyName,
              ...(hasEnvOverride
                ? {
                    envKeyOverride: {
                      keyName: envKeyPrefix,
                      note: "ABLY_API_KEY env var overrides this key for product API commands",
                    },
                  }
                : {}),
            },
          },
          flags,
        );
      } else {
        this.log(formatHeading("Key Details"));
        this.log(`${formatLabel("Key Name")} ${formatResource(keyName)}`);
        this.log(
          `${formatLabel("Key Label")} ${fullKeyObject.name || "Unnamed key"}`,
        );

        for (const line of formatCapabilities(
          fullKeyObject.capability as Record<string, string[] | string>,
        )) {
          this.log(line);
        }

        this.log(
          `${formatLabel("Created")} ${this.formatDate(fullKeyObject.created)}`,
        );
        this.log(
          `${formatLabel("Updated")} ${this.formatDate(fullKeyObject.modified)}`,
        );
        this.log(`${formatLabel("Full key")} ${fullKeyObject.key}`);

        if (hasEnvOverride) {
          this.logToStderr("");
          this.logWarning(
            `ABLY_API_KEY environment variable is set to a different key (${envKeyPrefix}). ` +
              `The env var overrides this key for product API commands.`,
            flags,
          );
        }
      }
    } catch (error) {
      this.fail(error, flags, "keyGet", { appId, keyIdentifier });
    }
  }
}
