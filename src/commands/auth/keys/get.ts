import { Args, Flags } from "@oclif/core";

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

    let appId: string | undefined;
    const keyIdentifier = args.keyNameOrValue;

    // Resolve appId. The keyNameOrValue arg accepts four formats:
    //   1. Full key value  — "APP_ID.KEY_ID:SECRET"  (contains ":" and ".")
    //   2. Key name        — "APP_ID.KEY_ID"          (contains ".", no ":")
    //   3. Key ID          — "KEY_ID"                  (no "." or ":")
    //   4. Key label       — "Root"                    (free-text, no "." or ":")
    //
    // For formats 1 & 2 the appId is embedded in the identifier and extracted
    // below. For formats 3 & 4 an explicit --app flag or current app is needed.
    // The actual key matching (by all four formats) is handled by getKey().
    if (flags.app) {
      appId = await this.resolveAppIdFromNameOrId(flags.app, flags);
    }

    if (!appId && keyIdentifier.includes(".")) {
      if (keyIdentifier.includes(":")) {
        // Format 1: full key value — extract appId before the first dot
        appId = keyIdentifier.split(".")[0];
      } else {
        // Format 2: key name — extract appId when exactly "APP_ID.KEY_ID"
        const parts = keyIdentifier.split(".");
        if (parts.length === 2) {
          appId = parts[0];
        }
      }
    }

    // Formats 3 & 4 (key ID or label) — fall back to --app or current app
    if (!appId) {
      appId = await this.requireAppId(flags);
    }

    // Display authentication information (after app resolution so name→ID is correct)
    await this.showAuthInfoIfNeeded(flags);

    try {
      this.logProgress("Fetching key details", flags);

      const controlApi = this.createControlApi(flags);
      const key = await controlApi.getKey(appId, keyIdentifier);

      const keyName = `${key.appId}.${key.id}`;

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
              ...key,
              created: new Date(key.created).toISOString(),
              modified: new Date(key.modified).toISOString(),
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
