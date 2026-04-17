import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";

import { AblyBaseCommand } from "../../../base-command.js";
import { clientIdFlag, productApiFlags } from "../../../flags.js";
import {
  extractSummarizationType,
  validateAnnotationParams,
} from "../../../utils/annotations.js";
import { formatResource } from "../../../utils/output.js";

export default class ChannelsAnnotationsDelete extends AblyBaseCommand {
  static override args = {
    channelName: Args.string({
      description: "The channel name",
      required: true,
    }),
    messageSerial: Args.string({
      description: "The serial of the message to remove annotation from",
      required: true,
    }),
    annotationType: Args.string({
      description:
        "The annotation type (e.g., reactions:flag.v1, reactions:multiple.v1)",
      required: true,
    }),
  };

  static override description = "Delete an annotation from a channel message";

  static override examples = [
    '$ ably channels annotations delete my-channel "01234567890:0" "receipts:flag.v1"',
    '$ ably channels annotations delete my-channel "01234567890:0" "categories:distinct.v1" --name important',
    '$ ably channels annotations delete my-channel "01234567890:0" "reactions:unique.v1" --name thumbsup',
    '$ ably channels annotations delete my-channel "01234567890:0" "rating:multiple.v1" --name stars',
    '$ ably channels annotations delete my-channel "01234567890:0" "receipts:flag.v1" --json',
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    name: Flags.string({
      char: "n",
      description: "The annotation name (e.g., emoji name for reactions)",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsAnnotationsDelete);
    const channelName = args.channelName;
    const serial = args.messageSerial;
    const type = args.annotationType;

    let client: Ably.Realtime | null = null;

    try {
      const summarization = extractSummarizationType(type);
      const validationErrors = validateAnnotationParams(summarization, {
        name: flags.name,
      });
      if (validationErrors.length > 0) {
        this.fail(validationErrors.join("\n"), flags, "annotationDelete");
      }

      // Uses Realtime client because RestAnnotations.delete is not exposed in SDK types
      client = await this.createAblyRealtimeClient(flags);
      if (!client) return;

      const channel = client.channels.get(channelName);

      this.logProgress(
        `Deleting annotation on message ${formatResource(serial)} in channel ${formatResource(channelName)}`,
        flags,
      );

      const annotation: Ably.OutboundAnnotation = { type };
      if (flags.name !== undefined) annotation.name = flags.name;

      await channel.annotations.delete(serial, annotation);

      this.logCliEvent(
        flags,
        "annotationDelete",
        "annotationDeleted",
        `Deleted annotation on message ${serial} in channel ${channelName}`,
        {
          channel: channelName,
          serial,
          type,
          ...(flags.name === undefined ? {} : { name: flags.name }),
        },
      );

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            annotation: {
              channel: channelName,
              serial,
              type,
              ...(flags.name === undefined ? {} : { name: flags.name }),
            },
          },
          flags,
        );
      }

      this.logSuccessMessage(
        `Annotation deleted on message ${formatResource(serial)} in channel ${formatResource(channelName)}.`,
        flags,
      );
    } catch (error) {
      this.fail(error, flags, "annotationDelete", {
        channel: channelName,
        serial,
        type,
      });
    } finally {
      client?.close();
    }
  }
}
