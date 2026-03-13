import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";

import { AblyBaseCommand } from "../../../base-command.js";
import { productApiFlags } from "../../../flags.js";
import {
  formatCountLabel,
  formatIndex,
  formatLabel,
  formatLimitWarning,
  formatProgress,
  formatResource,
  formatTimestamp,
  formatMessageTimestamp,
  formatClientId,
  formatEventType,
} from "../../../utils/output.js";
import { formatMessageData } from "../../../utils/json-formatter.js";

export default class ChannelsAnnotationsGet extends AblyBaseCommand {
  static override args = {
    channel: Args.string({
      description: "The channel name",
      required: true,
    }),
    serial: Args.string({
      description: "The serial of the message to get annotations for",
      required: true,
    }),
  };

  static override description = "Get annotations for a channel message";

  static override examples = [
    '$ ably channels annotations get my-channel "01234567890:0"',
    '$ ably channels annotations get my-channel "01234567890:0" --limit 100',
    '$ ably channels annotations get my-channel "01234567890:0" --json',
    '$ ably channels annotations get my-channel "01234567890:0" --pretty-json',
  ];

  static override flags = {
    ...productApiFlags,
    limit: Flags.integer({
      default: 100,
      description: "Maximum number of results to return (default: 100)",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsAnnotationsGet);
    const channelName = args.channel;
    const serial = args.serial;

    try {
      const rest = await this.createAblyRestClient(flags);
      if (!rest) return;

      const channel = rest.channels.get(channelName);

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Getting annotations for message ${formatResource(serial)} in channel ${formatResource(channelName)}`,
          ),
        );
      }

      const params: Ably.GetAnnotationsParams = { limit: flags.limit };

      const result = await channel.annotations.get(serial, params);
      const annotations = result.items || [];

      this.logCliEvent(
        flags,
        "annotationGet",
        "annotationsFetched",
        `Fetched annotations for message ${serial} in channel ${channelName}`,
        { channel: channelName, serial, count: annotations.length },
      );

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          { channel: channelName, serial, annotations },
          flags,
        );
      } else {
        if (annotations.length === 0) {
          this.log("No annotations found for this message.");
          return;
        }

        this.log(
          `Found ${formatCountLabel(annotations.length, "annotation")} for message ${formatResource(serial)} in channel ${formatResource(channelName)}`,
        );
        this.log("");

        for (const [index, annotation] of annotations.entries()) {
          const timestampDisplay = annotation.timestamp
            ? formatTimestamp(formatMessageTimestamp(annotation.timestamp))
            : formatTimestamp("Unknown timestamp");

          this.log(`${formatIndex(index + 1)} ${timestampDisplay}`);
          this.log(
            `${formatLabel("Type")} ${formatEventType(annotation.type || "(none)")}`,
          );

          if (annotation.name) {
            this.log(`${formatLabel("Name")} ${annotation.name}`);
          }

          if (annotation.clientId) {
            this.log(
              `${formatLabel("Client ID")} ${formatClientId(annotation.clientId)}`,
            );
          }

          if (annotation.count !== undefined) {
            this.log(`${formatLabel("Count")} ${annotation.count}`);
          }

          if (annotation.data !== undefined) {
            this.log(formatLabel("Data"));
            this.log(formatMessageData(annotation.data));
          }

          this.log("");
        }

        const warning = formatLimitWarning(
          annotations.length,
          flags.limit,
          "annotations",
        );
        if (warning) this.log(warning);
      }
    } catch (error) {
      this.fail(error, flags, "annotationGet", {
        channel: channelName,
        serial,
      });
    }
  }
}
