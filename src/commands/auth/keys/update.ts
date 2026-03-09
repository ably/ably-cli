import { Args, Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { errorMessage } from "../../../utils/errors.js";
import { formatCapabilityInline } from "../../../utils/key-display.js";
import { parseKeyIdentifier } from "../../../utils/key-parsing.js";

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
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "The app ID (defaults to current app)",
      env: "ABLY_APP_ID",
    }),
    capabilities: Flags.string({
      description: "New capabilities for the key (comma-separated list)",
      required: false,
    }),
    name: Flags.string({
      description: "New name for the key",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(KeysUpdateCommand);

    const controlApi = this.createControlApi(flags);

    let appId = flags.app || this.configManager.getCurrentAppId();
    let keyId = args.keyName;

    const parsed = parseKeyIdentifier(args.keyName);
    if (parsed.appId) appId = parsed.appId;
    keyId = parsed.keyId;

    if (!appId) {
      this.error(
        'No app specified. Please provide --app flag, include APP_ID in the key name, or switch to an app with "ably apps switch".',
      );
    }

    // Check if any update flags were provided
    if (!flags.name && !flags.capabilities) {
      this.error(
        "No updates specified. Please provide at least one property to update (--name or --capabilities).",
      );
    }

    try {
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
        // Parse the capabilities string into the expected format
        // The expected format is a Record<string, string[]> (channel => permissions)
        try {
          // Split by commas to get individual capabilities
          const capabilityArray = flags.capabilities
            .split(",")
            .map((cap) => cap.trim());
          // Create capability object with "*" channel and array of capabilities
          updateData.capability = {
            "*": capabilityArray,
          };
        } catch (error) {
          this.error(`Invalid capabilities format: ${errorMessage(error)}`);
        }
      }

      // Update the key
      const updatedKey = await controlApi.updateKey(appId, keyId, updateData);

      const keyName = `${updatedKey.appId}.${updatedKey.id}`;
      this.log(`Key Name: ${keyName}`);

      if (flags.name) {
        this.log(
          `Key Label: "${originalKey.name || "Unnamed key"}" → "${updatedKey.name || "Unnamed key"}"`,
        );
      }

      if (flags.capabilities) {
        this.log(`Capabilities:`);
        this.log(
          `  Before: ${formatCapabilityInline(originalKey.capability as Record<string, string[]>)}`,
        );
        this.log(
          `  After:  ${formatCapabilityInline(updatedKey.capability as Record<string, string[]>)}`,
        );
      }
    } catch (error) {
      this.error(`Error updating key: ${errorMessage(error)}`);
    }
  }
}
