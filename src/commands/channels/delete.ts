import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";

import { AblyBaseCommand } from "../../base-command.js";
import { clientIdFlag, productApiFlags } from "../../flags.js";
import {
  formatProgress,
  formatResource,
  formatSuccess,
  formatWarning,
} from "../../utils/output.js";

export default class ChannelsDelete extends AblyBaseCommand {
  static override args = {
    channel: Args.string({
      description: "The channel name",
      required: true,
    }),
    serial: Args.string({
      description: "The serial of the message to delete",
      required: true,
    }),
  };

  static override description = "Delete a message on an Ably channel";

  static override examples = [
    '$ ably channels delete my-channel "01234567890:0"',
    '$ ably channels delete my-channel "01234567890:0" --description "Removed by admin"',
    '$ ably channels delete my-channel "01234567890:0" --json',
    '$ ably channels delete my-channel "01234567890:0" --pretty-json',
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    description: Flags.string({
      description: "Description of the delete operation",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsDelete);
    const channelName = args.channel;
    const serial = args.serial;

    try {
      const rest = await this.createAblyRestClient(flags);
      if (!rest) return;

      const channel = rest.channels.get(channelName);

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Deleting message ${formatResource(serial)} on channel ${formatResource(channelName)}`,
          ),
        );
      }

      const message: Partial<Ably.Message> = { serial };
      const operation: Ably.MessageOperation | undefined = flags.description
        ? { description: flags.description }
        : undefined;

      const result = await channel.deleteMessage(
        message as Ably.Message,
        operation,
      );

      const versionSerial = result?.versionSerial;

      this.logCliEvent(
        flags,
        "channelDelete",
        "messageDeleted",
        `Deleted message ${serial} on channel ${channelName}`,
        { channel: channelName, serial, versionSerial },
      );

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          { channel: channelName, serial, versionSerial },
          flags,
        );
      } else {
        this.log(
          formatSuccess(
            `Message ${formatResource(serial)} deleted on channel ${formatResource(channelName)}.`,
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
      this.fail(error, flags, "channelDelete", {
        channel: channelName,
        serial,
      });
    }
  }
}
