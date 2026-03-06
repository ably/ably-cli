import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";

import { AblyBaseCommand } from "../../../base-command.js";
import { clientIdFlag, productApiFlags } from "../../../flags.js";
import { resource, success } from "../../../utils/output.js";
import {
  extractSummarizationType,
  validateAnnotationParams,
} from "../../../utils/annotation-validation.js";

export default class ChannelsAnnotationsPublish extends AblyBaseCommand {
  static override args = {
    channel: Args.string({
      description: "Channel name",
      required: true,
    }),
    msgSerial: Args.string({
      description: "Message serial to annotate",
      required: true,
    }),
    annotationType: Args.string({
      description: "Annotation type (e.g., reactions:flag.v1)",
      required: true,
    }),
  };

  static override description = "Publish an annotation on a message";

  static override examples = [
    "$ ably channels annotations publish my-channel msg-serial-123 reactions:flag.v1",
    '$ ably channels annotations publish my-channel msg-serial-123 reactions:distinct.v1 --name "thumbsup"',
    "$ ably channels annotations publish my-channel msg-serial-123 reactions:multiple.v1 --name thumbsup --count 3",
    "$ ably channels annotations publish my-channel msg-serial-123 reactions:flag.v1 --json",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    name: Flags.string({
      description:
        "Annotation name (required for distinct/unique/multiple types)",
    }),
    count: Flags.integer({
      description: "Count value (required for multiple type)",
    }),
    data: Flags.string({
      description: "Optional data payload (JSON string)",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsAnnotationsPublish);

    try {
      // 1. Extract and validate summarization type
      const summarization = extractSummarizationType(args.annotationType);
      const errors = validateAnnotationParams(summarization, {
        name: flags.name,
        count: flags.count,
      });
      if (errors.length > 0) {
        this.error(errors.join("\n"));
      }

      // 2. Build OutboundAnnotation
      const annotation: Ably.OutboundAnnotation = {
        type: args.annotationType,
      };
      if (flags.name) annotation.name = flags.name;
      if (flags.count !== undefined) annotation.count = flags.count;
      if (flags.data) {
        try {
          annotation.data = JSON.parse(flags.data);
        } catch {
          this.error("Invalid JSON in --data flag. Please provide valid JSON.");
        }
      }

      // 3. Create Ably Realtime client and publish
      const client = await this.createAblyRealtimeClient(flags);
      if (!client) return;

      const channel = client.channels.get(args.channel);
      await channel.annotations.publish(args.msgSerial, annotation);

      // 4. Output success
      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              success: true,
              channel: args.channel,
              messageSerial: args.msgSerial,
              annotationType: args.annotationType,
              name: flags.name || null,
              count: flags.count ?? null,
            },
            flags,
          ),
        );
      } else {
        this.log(
          success(`Annotation published to channel ${resource(args.channel)}.`),
        );
      }
    } catch (error) {
      const errorMsg = `Error publishing annotation: ${error instanceof Error ? error.message : String(error)}`;
      if (this.shouldOutputJson(flags)) {
        this.jsonError({ error: errorMsg, success: false }, flags);
      } else {
        this.error(errorMsg);
      }
    }
  }
}
