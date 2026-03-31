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

export default class ChannelsAppend extends AblyBaseCommand {
  static override args = {
    channel: Args.string({
      description: "The channel name",
      required: true,
    }),
    serial: Args.string({
      description: "The serial of the message to append to",
      required: true,
    }),
    message: Args.string({
      description: "The message to append (JSON format or plain text)",
      required: true,
    }),
  };

  static override description = "Append data to a message on an Ably channel";

  static override examples = [
    '$ ably channels append my-channel "01234567890:0" \'{"data":"appended content"}\'',
    '$ ably channels append my-channel "01234567890:0" "Appended plain text"',
    '$ ably channels append my-channel "01234567890:0" \'{"data":"appended"}\' --name event-name',
    '$ ably channels append my-channel "01234567890:0" \'{"data":"appended"}\' --description "Added context"',
    '$ ably channels append my-channel "01234567890:0" \'{"data":"appended"}\' --json',
    '$ ably channels append my-channel "01234567890:0" \'{"data":"appended"}\' --pretty-json',
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    description: Flags.string({
      description: "Description of the append operation",
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
    const { args, flags } = await this.parse(ChannelsAppend);
    const channelName = args.channel;
    const serial = args.serial;

    try {
      const rest = await this.createAblyRestClient(flags);
      if (!rest) return;

      const channel = rest.channels.get(channelName);

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Appending to message ${formatResource(serial)} on channel ${formatResource(channelName)}`,
          ),
        );
      }

      const message = prepareMessageFromInput(args.message, flags, { serial });
      const operation: Ably.MessageOperation | undefined = flags.description
        ? { description: flags.description }
        : undefined;

      const result = await channel.appendMessage(message, operation);

      const versionSerial = result?.versionSerial;

      this.logCliEvent(
        flags,
        "channelAppend",
        "messageAppended",
        `Appended to message ${serial} on channel ${channelName}`,
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
            `Appended to message ${formatResource(serial)} on channel ${formatResource(channelName)}.`,
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
      this.fail(error, flags, "channelAppend", {
        channel: channelName,
        serial,
      });
    }
  }
}
