import { Args, Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { ControlApi } from "../../../services/control-api.js";
import { parseKeyIdentifier } from "../../../utils/key-parsing.js";
import { formatResource, formatSuccess } from "../../../utils/output.js";

export default class KeysSwitchCommand extends ControlBaseCommand {
  static args = {
    keyNameOrValue: Args.string({
      description:
        "Key name (APP_ID.KEY_ID) or full value of the key to switch to",
      required: false,
    }),
  };

  static description = "Switch to a different API key for the current app";

  static examples = [
    "$ ably auth keys switch",
    "$ ably auth keys switch APP_ID.KEY_ID",
    "$ ably auth keys switch KEY_ID --app APP_ID",
    "$ ably auth keys switch --json",
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "The app ID or name (defaults to current app)",
      env: "ABLY_APP_ID",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(KeysSwitchCommand);

    let keyId: string | undefined = args.keyNameOrValue;
    let extractedAppId: string | undefined;

    if (args.keyNameOrValue) {
      const parsed = parseKeyIdentifier(args.keyNameOrValue);
      if (parsed.appId) extractedAppId = parsed.appId;
      keyId = parsed.keyId;
    }

    const appId = extractedAppId ?? (await this.requireAppId(flags));

    try {
      const controlApi = this.createControlApi(flags);
      // Get current app name (if available) to preserve it
      const existingAppName = this.configManager.getAppName(appId);

      // If key ID or value is provided, switch directly
      if (args.keyNameOrValue && keyId) {
        await this.switchToKey(
          appId,
          keyId,
          controlApi,
          flags,
          existingAppName,
        );
        return;
      }

      // Otherwise, show interactive selection
      if (!this.shouldOutputJson(flags)) {
        this.log("Select a key to switch to:");
      }
      const selectedKey = await this.interactiveHelper.selectKey(
        controlApi,
        appId,
      );

      if (selectedKey) {
        const keyName = `${appId}.${selectedKey.id}`;

        // Get app details to ensure we have the app name
        let appName = existingAppName;

        // Fetch app details if we don't have a name
        if (!appName) {
          try {
            const app = await controlApi.getApp(appId);
            appName = app.name;
          } catch {
            // If we can't get the app, continue with just the app ID
            appName = undefined;
          }
        }

        // Store key with metadata
        this.configManager.storeAppKey(appId, selectedKey.key, {
          appName,
          keyId: selectedKey.id,
          keyName: selectedKey.name || "Unnamed key",
        });
        if (this.shouldOutputJson(flags)) {
          this.logJsonResult(
            {
              key: {
                appId,
                keyName,
                keyLabel: selectedKey.name || "Unnamed key",
              },
            },
            flags,
          );
        } else {
          this.log(
            formatSuccess(`Switched to key ${formatResource(keyName)}.`),
          );
        }
      } else {
        if (!this.shouldOutputJson(flags)) {
          this.log("Key switch cancelled.");
        }
      }
    } catch (error) {
      this.fail(error, flags, "keySwitch");
    }
  }

  private async switchToKey(
    appId: string,
    keyIdOrValue: string,
    controlApi: ControlApi,
    flags: Record<string, unknown>,
    existingAppName?: string,
  ): Promise<void> {
    try {
      // Verify the key exists and get full details
      const key = await controlApi.getKey(appId, keyIdOrValue);

      const keyName = `${appId}.${key.id}`;

      // Get app details to ensure we have the app name
      let appName = existingAppName;

      // Fetch app details if we don't have a name
      if (!appName) {
        try {
          const app = await controlApi.getApp(appId);
          appName = app.name;
        } catch {
          // If we can't get the app, continue with just the app ID
          appName = undefined;
        }
      }

      // Save to config with metadata
      this.configManager.storeAppKey(appId, key.key, {
        appName,
        keyId: key.id,
        keyName: key.name || "Unnamed key",
      });

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            key: {
              appId,
              keyName,
              keyLabel: key.name || "Unnamed key",
            },
          },
          flags,
        );
      } else {
        this.log(formatSuccess(`Switched to key ${formatResource(keyName)}.`));
      }
    } catch {
      this.fail(
        `Key "${keyIdOrValue}" not found or access denied.`,
        flags,
        "keySwitch",
      );
    }
  }
}
