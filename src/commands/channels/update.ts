import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";

import { AblyBaseCommand } from "../../base-command.js";
import { clientIdFlag, productApiFlags } from "../../flags.js";
import { prepareMessageFromInput } from "../../utils/message.js";
import {
  formatProgress,
  formatResource,
  formatSuccess,
  formatWarning,
} from "../../utils/output.js";

export default class ChannelsUpdate extends AblyBaseCommand {
  static override args = {
    channel: Args.string({
      description: "The channel name",
      required: true,
    }),
    serial: Args.string({
      description: "The serial of the message to update",
      required: true,
    }),
    message: Args.string({
      description: "The updated message (JSON format or plain text)",
      required: true,
    }),
  };

  static override description = "Update a message on an Ably channel";

  static override examples = [
    '$ ably channels update my-channel "01234567890:0" \'{"data":"updated content"}\'',
    '$ ably channels update my-channel "01234567890:0" "Updated plain text"',
    '$ ably channels update my-channel "01234567890:0" \'{"data":"updated"}\' --name event-name',
    '$ ably channels update my-channel "01234567890:0" \'{"data":"updated"}\' --description "Corrected typo"',
    '$ ably channels update my-channel "01234567890:0" \'{"data":"updated"}\' --json',
    '$ ably channels update my-channel "01234567890:0" \'{"data":"updated"}\' --pretty-json',
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    description: Flags.string({
      description: "Description of the update operation",
    }),
    encoding: Flags.string({
      char: "e",
      description: "The encoding for the message",
    }),
    name: Flags.string({
      char: "n",
      description: "The event name",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsUpdate);
    const channelName = args.channel;
    const serial = args.serial;

    try {
      const rest = await this.createAblyRestClient(flags);
      if (!rest) return;

      const channel = rest.channels.get(channelName);

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Updating message ${formatResource(serial)} on channel ${formatResource(channelName)}`,
          ),
        );
      }

      const message = prepareMessageFromInput(args.message, flags, { serial });
      const operation: Ably.MessageOperation | undefined = flags.description
        ? { description: flags.description }
        : undefined;

      const result = await channel.updateMessage(message, operation);

      const versionSerial = result.versionSerial;

      this.logCliEvent(
        flags,
        "channelUpdate",
        "messageUpdated",
        `Updated message ${serial} on channel ${channelName}`,
        { channel: channelName, serial, versionSerial },
      );

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          { message: { channel: channelName, serial, versionSerial } },
          flags,
        );
      } else {
        this.log(
          formatSuccess(
            `Message ${formatResource(serial)} updated on channel ${formatResource(channelName)}.`,
          ),
        );
        if (versionSerial) {
          this.log(`  Version serial: ${formatResource(versionSerial)}`);
        } else if (versionSerial === null) {
          this.log(
            formatWarning("Message was superseded by a subsequent operation."),
          );
        }
      }
    } catch (error) {
      this.fail(error, flags, "channelUpdate", {
        channel: channelName,
        serial,
      });
    }
  }
}
