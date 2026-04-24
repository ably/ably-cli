import { Args, Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { ControlApi } from "../../../services/control-api.js";
import { formatResource } from "../../../utils/output.js";

export default class KeysSwitchCommand extends ControlBaseCommand {
  static args = {
    keyNameOrValue: Args.string({
      description:
        "Key name (APP_ID.KEY_ID), key ID, key label (e.g. Root), or full key value",
      required: false,
    }),
  };

  static description = "Switch to a different API key for the current app";

  static examples = [
    "$ ably auth keys switch",
    "$ ably auth keys switch APP_ID.KEY_ID",
    '$ ably auth keys switch Root --app "My App"',
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

    const keyIdentifier = args.keyNameOrValue;
    let appId: string | undefined;

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

    if (!appId && keyIdentifier?.includes(".")) {
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

    try {
      const controlApi = this.createControlApi(flags);
      // Get current app name (if available) to preserve it
      const existingAppName = this.configManager.getAppName(appId);

      // If a key identifier is provided, resolve and switch directly
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
      }

      this.logSuccessMessage(
        `Switched to key ${formatResource(keyName)}.`,
        flags,
      );
    } catch {
      this.fail(
        `Key "${keyIdOrValue}" not found or access denied.`,
        flags,
        "keySwitch",
      );
    }
  }
}
