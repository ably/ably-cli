import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";

import { AblyBaseCommand } from "../../base-command.js";
import { CommandError } from "../../errors/command-error.js";
import { productApiFlags } from "../../flags.js";
import {
  formatMessageTimestamp,
  formatMessagesOutput,
  formatResource,
} from "../../utils/output.js";
import type { MessageDisplayFields } from "../../utils/output.js";

const MUTABLE_MESSAGES_HINT =
  "The channel may not have mutableMessages enabled — without this rule, individual messages cannot be retrieved by serial. Please check the same using 'ably apps rules list'. If the 'Mutable Messages' rule is enabled, then make sure to enter correct message serial.";

export default class ChannelsGetMessage extends AblyBaseCommand {
  static override args = {
    channelName: Args.string({
      description: "The channel name",
      required: true,
    }),
    messageSerial: Args.string({
      description: "The serial of the message to retrieve",
      required: true,
    }),
  };

  static override description =
    "Get the latest version of a message on an Ably channel. Requires `mutableMessages` enabled on the channel rule.";

  static override examples = [
    '$ ably channels get-message my-channel "01234567890:0"',
    '$ ably channels get-message my-channel "01234567890:0" --json',
    '$ ably channels get-message my-channel "01234567890:0" --pretty-json',
    '$ ably channels get-message my-channel "01234567890:0" --cipher YOUR_CIPHER_KEY',
  ];

  static override flags = {
    ...productApiFlags,
    cipher: Flags.string({
      description:
        "Decryption key for encrypted messages (base64-encoded or hex-encoded, supports AES-128-CBC and AES-256-CBC)",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsGetMessage);
    const channelName = args.channelName;
    const serial = args.messageSerial;

    try {
      const rest = await this.createAblyRestClient(flags);
      if (!rest) return;

      const channelOptions: Ably.ChannelOptions = {};
      if (flags.cipher) {
        channelOptions.cipher = { key: flags.cipher };
      }

      const channel = rest.channels.get(channelName, channelOptions);

      this.logProgress(
        `Fetching message ${formatResource(serial)} on channel ${formatResource(channelName)}`,
        flags,
      );

      const message = await channel.getMessage(serial);

      const tracePayload = {
        id: message.id,
        timestamp: formatMessageTimestamp(message.timestamp),
        channel: channelName,
        event: message.name || undefined,
        clientId: message.clientId,
        connectionId: message.connectionId,
        data: message.data as unknown,
        encoding: message.encoding,
        extras: message.extras as unknown,
        action:
          message.action === undefined ? undefined : String(message.action),
        serial: message.serial,
        version: message.version,
        annotations: message.annotations,
      };
      this.logCliEvent(
        flags,
        "channelGetMessage",
        "messageRetrieved",
        `Retrieved message ${message.serial ?? serial} on channel ${channelName}`,
        tracePayload,
      );

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            message: {
              ...message,
              // Stringify action for predictable JSON typing across commands
              // (matches `channels subscribe`'s explicit normalisation).
              action:
                message.action === undefined
                  ? undefined
                  : String(message.action),
              // Nullish-aware: a legitimate epoch-zero timestamp must not be
              // dropped to undefined.
              timestamp:
                message.timestamp == null
                  ? undefined
                  : new Date(message.timestamp).toISOString(),
            },
          },
          flags,
        );
      } else {
        const display: MessageDisplayFields = {
          action:
            message.action === undefined ? undefined : String(message.action),
          channel: channelName,
          clientId: message.clientId,
          data: message.data,
          event: message.name || undefined,
          id: message.id,
          serial: message.serial,
          timestamp: message.timestamp ?? Date.now(),
          version: message.version,
          annotations: message.annotations,
        };
        this.log(formatMessagesOutput([display]));
      }
    } catch (error) {
      const cmdError = CommandError.from(error);
      const enriched =
        cmdError.code === 40400
          ? new CommandError(`${cmdError.message}\n${MUTABLE_MESSAGES_HINT}`, {
              code: cmdError.code,
              statusCode: cmdError.statusCode,
              context: cmdError.context,
            })
          : error;
      this.fail(enriched, flags, "channelGetMessage", {
        channel: channelName,
        serial,
      });
    }
  }
}
