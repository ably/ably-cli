import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";

import { AblyBaseCommand } from "../../../base-command.js";
import { clientIdFlag, productApiFlags } from "../../../flags.js";
import {
  extractSummarizationType,
  validateAnnotationParams,
} from "../../../utils/annotations.js";
import {
  formatProgress,
  formatResource,
  formatSuccess,
} from "../../../utils/output.js";

export default class ChannelsAnnotationsPublish extends AblyBaseCommand {
  static override args = {
    channel: Args.string({
      description: "The channel name",
      required: true,
    }),
    serial: Args.string({
      description: "The serial of the message to annotate",
      required: true,
    }),
    type: Args.string({
      description:
        "The annotation type (e.g., reactions:flag.v1, reactions:multiple.v1)",
      required: true,
    }),
  };

  static override description = "Publish an annotation on a channel message";

  static override examples = [
    '$ ably channels annotations publish my-channel "01234567890:0" "metrics:total.v1"',
    '$ ably channels annotations publish my-channel "01234567890:0" "receipts:flag.v1"',
    '$ ably channels annotations publish my-channel "01234567890:0" "categories:distinct.v1" --name important',
    '$ ably channels annotations publish my-channel "01234567890:0" "reactions:unique.v1" --name thumbsup',
    '$ ably channels annotations publish my-channel "01234567890:0" "rating:multiple.v1" --name stars --count 4',
    '$ ably channels annotations publish my-channel "01234567890:0" "metrics:total.v1" --json',
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    count: Flags.integer({
      description: "The annotation count (for multiple.v1 types)",
    }),
    data: Flags.string({
      description: "Arbitrary annotation payload (JSON string or plain text)",
    }),
    encoding: Flags.string({
      char: "e",
      description: "The encoding for the annotation data",
    }),
    name: Flags.string({
      char: "n",
      description: "The annotation name (e.g., emoji name for reactions)",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsAnnotationsPublish);
    this.validateChannelName(args, flags);
    const channelName = args.channel;
    const serial = args.serial;
    const type = args.type;

    try {
      const summarization = extractSummarizationType(type);
      const validationErrors = validateAnnotationParams(summarization, {
        name: flags.name,
      });
      if (validationErrors.length > 0) {
        this.fail(validationErrors.join("\n"), flags, "annotationPublish");
      }

      const rest = await this.createAblyRestClient(flags);
      if (!rest) return;

      const channel = rest.channels.get(channelName);

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Publishing annotation on message ${formatResource(serial)} in channel ${formatResource(channelName)}`,
          ),
        );
      }

      const annotation: Ably.OutboundAnnotation = { type };
      if (flags.name !== undefined) annotation.name = flags.name;
      if (flags.count !== undefined) annotation.count = flags.count;
      if (flags.data !== undefined) {
        try {
          annotation.data = JSON.parse(flags.data);
        } catch {
          annotation.data = flags.data;
        }
      }

      if (flags.encoding !== undefined) annotation.encoding = flags.encoding;

      await channel.annotations.publish(serial, annotation);

      this.logCliEvent(
        flags,
        "annotationPublish",
        "annotationPublished",
        `Published annotation on message ${serial} in channel ${channelName}`,
        { channel: channelName, serial, type, name: flags.name },
      );

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          { channel: channelName, serial, type, name: flags.name },
          flags,
        );
      } else {
        this.log(
          formatSuccess(
            `Annotation published on message ${formatResource(serial)} in channel ${formatResource(channelName)}.`,
          ),
        );
      }
    } catch (error) {
      this.fail(error, flags, "annotationPublish", {
        channel: channelName,
        serial,
        type,
      });
    }
  }
}
