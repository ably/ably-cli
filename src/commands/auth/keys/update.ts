import { Args, Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { formatCapabilityInline } from "../../../utils/key-display.js";
import { parseCapabilities } from "../../../utils/key-parsing.js";
import { formatLabel, formatResource } from "../../../utils/output.js";

export default class KeysUpdateCommand extends ControlBaseCommand {
  static args = {
    keyNameOrValue: Args.string({
      description:
        "Key name (APP_ID.KEY_ID), key ID, key label (e.g. Root), or full key value",
      required: true,
    }),
  };

  static description = "Update a key's properties";

  static examples = [
    '$ ably auth keys update APP_ID.KEY_ID --name "New Name"',
    '$ ably auth keys update Root --app APP_ID --name "New Name"',
    '$ ably auth keys update KEY_ID --app APP_ID --capabilities "publish,subscribe"',
    `$ ably auth keys update APP_ID.KEY_ID --capabilities '{"channel1":["publish"],"channel2":["subscribe"]}'`,
    '$ ably auth keys update APP_ID.KEY_ID --name "New Name" --json',
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "The app ID or name (defaults to current app)",
      env: "ABLY_APP_ID",
    }),
    capabilities: Flags.string({
      description:
        "New capabilities as JSON object (per-channel) or comma-separated list (all channels)",
      required: false,
    }),
    name: Flags.string({
      description: "New name for the key",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(KeysUpdateCommand);

    // Check if any update flags were provided before doing any API calls
    if (!flags.name && !flags.capabilities) {
      this.fail(
        "No updates specified. Please provide at least one property to update (--name or --capabilities).",
        flags,
        "keyUpdate",
      );
    }

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

    try {
      const controlApi = this.createControlApi(flags);
      // Get original key details
      const originalKey = await controlApi.getKey(appId, keyIdentifier);

      // Prepare the update data
      const updateData: {
        capability?: Record<string, string[]>;
        name?: string;
      } = {};

      if (flags.name) {
        updateData.name = flags.name;
      }

      if (flags.capabilities) {
        try {
          updateData.capability = parseCapabilities(flags.capabilities);
        } catch (error) {
          this.fail(error, flags, "keyUpdate");
        }
      }

      // Update the key
      const updatedKey = await controlApi.updateKey(
        appId,
        originalKey.id,
        updateData,
      );

      const keyName = `${updatedKey.appId}.${updatedKey.id}`;

      if (this.shouldOutputJson(flags)) {
        const keyData: Record<string, unknown> = { keyName };
        if (flags.name) {
          keyData.name = {
            before: originalKey.name || "Unnamed key",
            after: updatedKey.name || "Unnamed key",
          };
        }
        if (flags.capabilities) {
          keyData.capabilities = {
            before: originalKey.capability,
            after: updatedKey.capability,
          };
        }
        this.logJsonResult({ key: keyData }, flags);
      } else {
        this.log(`${formatLabel("Key Name")} ${formatResource(keyName)}`);

        if (flags.name) {
          this.log(
            `${formatLabel("Key Label")} "${originalKey.name || "Unnamed key"}" → "${updatedKey.name || "Unnamed key"}"`,
          );
        }

        if (flags.capabilities) {
          this.log(`${formatLabel("Capabilities")}`);
          this.log(
            `  ${formatLabel("Before")} ${formatCapabilityInline(originalKey.capability as Record<string, string[]>)}`,
          );
          this.log(
            `  ${formatLabel("After")} ${formatCapabilityInline(updatedKey.capability as Record<string, string[]>)}`,
          );
        }
      }
    } catch (error) {
      this.fail(error, flags, "keyUpdate");
    }
  }
}
