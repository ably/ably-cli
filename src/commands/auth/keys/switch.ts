import { Args, Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { ControlApi } from "../../../services/control-api.js";
import { formatResource } from "../../../utils/output.js";

export default class KeysSwitchCommand extends ControlBaseCommand {
  static args = {
    keyNameOrValue: Args.string({
      description:
        'Key name "<APP_ID>.<KEY_ID>" or value "<APP_ID>.<KEY_ID>:<KEY_SECRET>"',
      required: false,
    }),
  };

  static description = "Switch to a different API key for the current app";

  static examples = [
    "$ ably auth keys switch",
    '$ ably auth keys switch "APP_ID.KEY_ID"',
    '$ ably auth keys switch "APP_ID.KEY_ID:KEY_SECRET"',
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

    const keyIdentifier = args.keyNameOrValue;

    // When a key identifier is provided, extract appId from it.
    // Otherwise, resolve appId from --app flag or current app for interactive selection.
    const appId = keyIdentifier
      ? this.resolveAppIdForKey(keyIdentifier, flags)
      : await this.requireAppId(flags);

    try {
      const controlApi = this.createControlApi(flags);
      const existingAppName = this.configManager.getAppName(appId);

      // Key identifier provided — switch directly
      if (keyIdentifier) {
        await this.switchToKey(
          appId,
          keyIdentifier,
          controlApi,
          flags,
          existingAppName,
        );
        return;
      }

      // No key identifier — show interactive key selection

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
        }

        this.logSuccessMessage(
          `Switched to key ${formatResource(keyName)}.`,
          flags,
        );
      } else {
        this.logWarning("Key switch cancelled.", flags);
      }
    } catch (error) {
      this.fail(error, flags, "keySwitch");
    }
  }

  private async switchToKey(
    appId: string,
    keyIdentifier: string,
    controlApi: ControlApi,
    flags: Record<string, unknown>,
    existingAppName?: string,
  ): Promise<void> {
    try {
      // Verify the key exists and get full details
      const fullKeyObject = await controlApi.getKey(appId, keyIdentifier);

      const keyName = `${appId}.${fullKeyObject.id}`;

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
      this.configManager.storeAppKey(appId, fullKeyObject.key, {
        appName,
        keyId: fullKeyObject.id,
        keyName: fullKeyObject.name || "Unnamed key",
      });

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            key: {
              appId,
              keyName,
              keyLabel: fullKeyObject.name || "Unnamed key",
            },
          },
          flags,
        );
      }

      this.logSuccessMessage(
        `Switched to key ${formatResource(keyName)}.`,
        flags,
      );
    } catch {
      this.fail(
        `Key "${keyIdentifier}" not found or access denied. Run "ably auth keys list" to see available keys.`,
        flags,
        "keySwitch",
      );
    }
  }
}
