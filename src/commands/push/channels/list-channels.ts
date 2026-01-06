import { Flags } from "@oclif/core";
import { AblyBaseCommand } from "../../../base-command.js";
import chalk from "chalk";

export default class PushChannelsListChannels extends AblyBaseCommand {
  static override description =
    "List all channels that have at least one push subscription (maps to push.admin.channelSubscriptions.listChannels)";

  static override examples = [
    // List all channels with push subscriptions
    "$ ably push channels list-channels",
    // With limit
    "$ ably push channels list-channels --limit 50",
    // JSON output
    "$ ably push channels list-channels --json",
  ];

  static override flags = {
    ...AblyBaseCommand.globalFlags,
    limit: Flags.integer({
      description: "Maximum number of results (default: 100, max: 1000)",
      default: 100,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushChannelsListChannels);

    try {
      const rest = await this.createAblyRestClient(flags);
      if (!rest) {
        return;
      }

      // List channels with push subscriptions
      const result = await rest.push.admin.channelSubscriptions.listChannels({
        limit: Math.min(flags.limit, 1000),
      });
      const channels = result.items;

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              channels: channels,
              count: channels.length,
              success: true,
              timestamp: new Date().toISOString(),
            },
            flags,
          ),
        );
      } else {
        this.log(
          chalk.bold(
            `Channels with Push Subscriptions (${channels.length} found)\n`,
          ),
        );

        if (channels.length === 0) {
          this.log(chalk.dim("No channels with push subscriptions found."));
          return;
        }

        // Table header
        this.log(chalk.dim("CHANNEL"));
        this.log(chalk.dim("-".repeat(50)));

        // List channels
        for (const channel of channels) {
          this.log(channel);
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorCode = (error as { code?: number }).code;

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              error: errorMessage,
              code: errorCode,
              success: false,
            },
            flags,
          ),
        );
        this.exit(1);
      } else {
        this.error(`Error listing channels: ${errorMessage}`);
      }
    }
  }
}
