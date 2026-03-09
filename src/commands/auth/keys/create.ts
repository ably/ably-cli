import { Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { errorMessage } from "../../../utils/errors.js";
import { formatCapabilities } from "../../../utils/key-display.js";
import {
  formatProgress,
  formatResource,
  formatSuccess,
} from "../../../utils/output.js";

export default class KeysCreateCommand extends ControlBaseCommand {
  static description = "Create a new API key for an app";

  static examples = [
    `$ ably auth keys create --name "My New Key"`,
    `$ ably auth keys create --name "My New Key" --app APP_ID`,
    `$ ably auth keys create --name "My New Key" --capabilities '{"*":["*"]}'`,
    `$ ably auth keys create --name "My New Key" --capabilities '{"channel1":["publish","subscribe"],"channel2":["history"]}'`,
    `$ ably auth keys create --name "My New Key" --json`,
    `$ ably auth keys create --name "My New Key" --pretty-json`,
    `$ ably auth keys create --app <appId> --name "MyKey" --capabilities '{"channel:*":["publish"]}'`,
    `$ ably auth keys create --app <appId> --name "MyOtherKey" --capabilities '{"channel:chat-*":["subscribe"],"channel:updates":["publish"]}' --ttl 86400`,
    `$ ably auth keys create --name "My New Key" --capabilities '{"channel1":["publish","subscribe"],"channel2":["history"]}'`,
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "The app ID or name (defaults to current app)",
      env: "ABLY_APP_ID",
    }),
    capabilities: Flags.string({
      default: '{"*":["*"]}',
      description: `Capability object as a JSON string. Example: '{"channel:*":["publish"]}'`,
    }),
    name: Flags.string({
      description: "Name of the key",
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(KeysCreateCommand);

    const controlApi = this.createControlApi(flags);

    const appId = flags.app || this.configManager.getCurrentAppId();

    if (!appId) {
      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          {
            error:
              'No app specified. Please provide --app flag or switch to an app with "ably apps switch".',
            success: false,
          },
          flags,
        );
      } else {
        this.error(
          'No app specified. Please provide --app flag or switch to an app with "ably apps switch".',
        );
      }

      return;
    }

    let capabilities;
    try {
      capabilities = JSON.parse(flags.capabilities);
    } catch {
      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          {
            error:
              "Invalid capabilities JSON format. Please provide a valid JSON string.",
            success: false,
          },
          flags,
        );
      } else {
        this.error(
          "Invalid capabilities JSON format. Please provide a valid JSON string.",
        );
      }

      return;
    }

    try {
      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Creating key ${formatResource(flags.name)} for app ${formatResource(appId)}`,
          ),
        );
      }

      const key = await controlApi.createKey(appId, {
        capability: capabilities,
        name: flags.name,
      });

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              key: {
                ...key,
                keyName: `${key.appId}.${key.id}`,
              },
              success: true,
            },
            flags,
          ),
        );
      } else {
        const keyName = `${key.appId}.${key.id}`;
        this.log(formatSuccess(`Key created: ${formatResource(keyName)}.`));
        this.log(`Key Name: ${keyName}`);
        this.log(`Key Label: ${key.name || "Unnamed key"}`);

        for (const line of formatCapabilities(
          key.capability as Record<string, string[] | string>,
        )) {
          this.log(line);
        }

        this.log(`Created: ${this.formatDate(key.created)}`);
        this.log(`Updated: ${this.formatDate(key.modified)}`);
        this.log(`Full key: ${key.key}`);

        // Tell the user how to switch to this key instead of doing it automatically
        this.log(
          `\nTo switch to this key, run: ably auth keys switch ${keyName}`,
        );
      }
    } catch (error) {
      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          {
            appId,
            error: errorMessage(error),
            success: false,
          },
          flags,
        );
      } else {
        this.error(`Error creating key: ${errorMessage(error)}`);
      }
    }
  }
}
