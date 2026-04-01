import { Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { formatCapabilities } from "../../../utils/key-display.js";
import { formatLabel, formatResource } from "../../../utils/output.js";

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

    const appId = await this.requireAppId(flags);

    let capabilities: Record<string, string[]>;
    try {
      capabilities = JSON.parse(flags.capabilities) as Record<string, string[]>;
    } catch {
      this.fail(
        "Invalid capabilities JSON format. Please provide a valid JSON string.",
        flags,
        "keyCreate",
      );
    }

    try {
      const controlApi = this.createControlApi(flags);
      this.logProgress(
        `Creating key ${formatResource(flags.name)} for app ${formatResource(appId)}`,
        flags,
      );

      const key = await controlApi.createKey(appId, {
        capability: capabilities,
        name: flags.name,
      });

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            key: {
              ...key,
              created: new Date(key.created).toISOString(),
              modified: new Date(key.modified).toISOString(),
              keyName: `${key.appId}.${key.id}`,
            },
          },
          flags,
        );
      } else {
        const keyName = `${key.appId}.${key.id}`;
        this.log(`${formatLabel("Key Name")} ${keyName}`);
        this.log(`${formatLabel("Key Label")} ${key.name || "Unnamed key"}`);

        for (const line of formatCapabilities(
          key.capability as Record<string, string[] | string>,
        )) {
          this.log(line);
        }

        this.log(`${formatLabel("Created")} ${this.formatDate(key.created)}`);
        this.log(`${formatLabel("Updated")} ${this.formatDate(key.modified)}`);
        this.log(`${formatLabel("Full key")} ${key.key}`);

        // Tell the user how to switch to this key instead of doing it automatically
        this.log(
          `\nTo switch to this key, run: ably auth keys switch ${keyName}`,
        );
      }

      const displayKeyName = `${key.appId}.${key.id}`;
      this.logSuccessMessage(
        `Key created: ${formatResource(displayKeyName)}.`,
        flags,
      );
    } catch (error) {
      this.fail(error, flags, "keyCreate", { appId });
    }
  }
}
