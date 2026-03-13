import { Args, Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
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
    '$ ably auth keys update APP_ID.KEY_ID --name "New Name" --json',
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "The app ID or name (defaults to current app)",
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

    // Check if any update flags were provided before doing any API calls
    if (!flags.name && !flags.capabilities) {
      this.fail(
        "No updates specified. Please provide at least one property to update (--name or --capabilities).",
        flags,
        "keyUpdate",
      );
    }

    let appId: string | undefined;
    let keyId = args.keyName;

    const parsed = parseKeyIdentifier(args.keyName);
    if (parsed.appId) appId = parsed.appId;
    keyId = parsed.keyId;

    if (!appId) {
      const resolved = await this.resolveAppId(flags);
      if (!resolved) {
        this.fail(
          'No app specified. Use --app flag, provide APP_ID.KEY_ID as the argument, or select an app with "ably apps switch"',
          flags,
          "keyUpdate",
        );
      }
      appId = resolved;
    }

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
          this.fail(error, flags, "keyUpdate", {
            context: "parsing capabilities",
          });
        }
      }

      // Update the key
      const updatedKey = await controlApi.updateKey(appId, keyId, updateData);

      const keyName = `${updatedKey.appId}.${updatedKey.id}`;

      if (this.shouldOutputJson(flags)) {
        const result: Record<string, unknown> = { keyName };
        if (flags.name) {
          result.name = {
            before: originalKey.name || "Unnamed key",
            after: updatedKey.name || "Unnamed key",
          };
        }
        if (flags.capabilities) {
          result.capabilities = {
            before: originalKey.capability,
            after: updatedKey.capability,
          };
        }
        this.logJsonResult(result, flags);
      } else {
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
      }
    } catch (error) {
      this.fail(error, flags, "keyUpdate");
    }
  }
}
