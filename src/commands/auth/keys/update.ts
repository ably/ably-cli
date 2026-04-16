import { Args, Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { formatCapabilityInline } from "../../../utils/key-display.js";
import {
  parseCapabilities,
  parseKeyIdentifier,
} from "../../../utils/key-parsing.js";
import { formatLabel, formatResource } from "../../../utils/output.js";

export default class KeysUpdateCommand extends ControlBaseCommand {
  static args = {
    keyName: Args.string({
      description: "Key name (APP_ID.KEY_ID) of the key to update",
      required: true,
    }),
  };

  static description = "Update a key's properties";

  static examples = [
    '$ ably auth keys update APP_ID.KEY_ID --name "New Name"',
    '$ ably auth keys update KEY_ID --app APP_ID --capabilities "publish,subscribe"',
    '$ ably auth keys update APP_ID.KEY_ID --name "New Name" --capabilities "publish,subscribe"',
    `$ ably auth keys update APP_ID.KEY_ID --name "New Name" --capabilities '{"channel1":["publish"],"channel2":["subscribe"]}'`,
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

    const parsed = parseKeyIdentifier(args.keyName);
    const keyId = parsed.keyId;

    const appId = parsed.appId ?? (await this.requireAppId(flags));

    try {
      const controlApi = this.createControlApi(flags);
      // Get original key details
      const originalKey = await controlApi.getKey(appId, keyId);

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
      const updatedKey = await controlApi.updateKey(appId, keyId, updateData);

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
