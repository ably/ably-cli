import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";
import chalk from "chalk";

import { AblyBaseCommand } from "../../../base-command.js";
import { productApiFlags } from "../../../flags.js";
import { formatTimestamp, resource } from "../../../utils/output.js";

export default class ChannelsAnnotationsGet extends AblyBaseCommand {
  static override args = {
    channel: Args.string({
      description: "Channel name",
      required: true,
    }),
    msgSerial: Args.string({
      description: "Message serial to get annotations for",
      required: true,
    }),
  };

  static override description = "Get annotations for a message";

  static override examples = [
    "$ ably channels annotations get my-channel msg-serial-123",
    "$ ably channels annotations get my-channel msg-serial-123 --limit 50",
    "$ ably channels annotations get my-channel msg-serial-123 --json",
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

    try {
      // 1. Create REST client (get is a REST operation)
      const client = await this.createAblyRestClient(flags);
      if (!client) return;

      // 2. Get channel and fetch annotations
      const channel = client.channels.get(args.channel);
      const params: Ably.GetAnnotationsParams = {};
      if (flags.limit !== undefined) {
        params.limit = flags.limit;
      }

      const result = await channel.annotations.get(args.msgSerial, params);
      const annotations = result.items;

      // 3. Output results
      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            annotations.map((annotation, index) => ({
              index: index + 1,
              id: annotation.id,
              action: annotation.action,
              type: annotation.type,
              name: annotation.name || null,
              clientId: annotation.clientId || null,
              count: annotation.count ?? null,
              data: annotation.data ?? null,
              messageSerial: annotation.messageSerial,
              serial: annotation.serial,
              timestamp: annotation.timestamp
                ? new Date(annotation.timestamp).toISOString()
                : null,
            })),
            flags,
          ),
        );
      } else {
        if (annotations.length === 0) {
          this.log(
            `No annotations found for message ${resource(args.msgSerial)} on channel ${resource(args.channel)}.`,
          );
          return;
        }

        this.log(
          `Annotations for message ${resource(args.msgSerial)} on channel ${resource(args.channel)}:\n`,
        );

        for (const [index, annotation] of annotations.entries()) {
          const timestamp = annotation.timestamp
            ? new Date(annotation.timestamp).toISOString()
            : new Date().toISOString();

          const actionLabel =
            annotation.action === "annotation.create"
              ? chalk.green("CREATE")
              : chalk.red("DELETE");

          this.log(
            `${chalk.dim(`[${index + 1}]`)} ${formatTimestamp(timestamp)} ${actionLabel} | ${chalk.dim("Type:")} ${annotation.type} | ${chalk.dim("Name:")} ${annotation.name || "(none)"} | ${chalk.dim("Client:")} ${annotation.clientId ? chalk.blue(annotation.clientId) : "(none)"}`,
          );
          if (annotation.count !== undefined) {
            this.log(`    ${chalk.dim("Count:")} ${annotation.count}`);
          }

          if (annotation.data) {
            this.log(
              `    ${chalk.dim("Data:")} ${JSON.stringify(annotation.data)}`,
            );
          }
        }

        if (annotations.length === flags.limit) {
          this.log("");
          this.log(
            chalk.yellow(
              `Showing maximum of ${flags.limit} annotations. Use --limit to show more.`,
            ),
          );
        }
      }
    } catch (error) {
      const errorMsg = `Error retrieving annotations: ${error instanceof Error ? error.message : String(error)}`;
      if (this.shouldOutputJson(flags)) {
        this.jsonError({ error: errorMsg, success: false }, flags);
      } else {
        this.error(errorMsg);
      }
    }
  }
}
