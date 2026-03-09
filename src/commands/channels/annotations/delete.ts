import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";

import { AblyBaseCommand } from "../../../base-command.js";
import { clientIdFlag, productApiFlags } from "../../../flags.js";
import {
  extractSummarizationType,
  validateAnnotationParams,
} from "../../../utils/annotations.js";
import { resource, success } from "../../../utils/output.js";

export default class ChannelsAnnotationsDelete extends AblyBaseCommand {
  static override description = "Delete an annotation from a message";

  static override examples = [
    "$ ably channels annotations delete my-channel msg-serial-123 reactions:flag.v1",
    "$ ably channels annotations delete my-channel msg-serial-123 reactions:distinct.v1 --name thumbsup",
    "$ ably channels annotations delete my-channel msg-serial-123 reactions:flag.v1 --json",
  ];

  static override args = {
    channel: Args.string({ description: "Channel name", required: true }),
    msgSerial: Args.string({
      description: "Message serial of the annotated message",
      required: true,
    }),
    annotationType: Args.string({
      description: "Annotation type (e.g., reactions:flag.v1)",
      required: true,
    }),
  };

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    name: Flags.string({
      description:
        "Annotation name (required for distinct/unique/multiple types)",
    }),
    data: Flags.string({ description: "Optional data payload (JSON string)" }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsAnnotationsDelete);

    try {
      // 1. Validate (same as publish, but count not needed for delete)
      const summarization = extractSummarizationType(args.annotationType);
      const errors = validateAnnotationParams(summarization, {
        name: flags.name,
        isDelete: true,
      });
      if (errors.length > 0) {
        this.error(errors.join("\n"));
      }

      // 2. Build OutboundAnnotation
      const annotation: Ably.OutboundAnnotation = {
        type: args.annotationType,
      };
      if (flags.name) annotation.name = flags.name;
      if (flags.data) {
        const parsed = this.parseJsonFlag(flags.data, "--data", flags);
        if (!parsed) return;
        annotation.data = parsed;
      }

      // 3. Create client and delete
      const client = await this.createAblyRealtimeClient(flags);
      if (!client) return;

      const channel = client.channels.get(args.channel);
      await channel.annotations.delete(args.msgSerial, annotation);

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
            },
            flags,
          ),
        );
      } else {
        this.log(
          success(`Annotation deleted from channel ${resource(args.channel)}.`),
        );
      }

      client.close();
    } catch (error) {
      this.handleCommandError(error, flags, "annotations:delete", {
        channel: args.channel,
        messageSerial: args.msgSerial,
      });
    }
  }
}
