import { Flags } from "@oclif/core";
import { AblyBaseCommand } from "../../../base-command.js";
import chalk from "chalk";

export default class PushChannelsList extends AblyBaseCommand {
  static override description =
    "List push channel subscriptions (maps to push.admin.channelSubscriptions.list)";

  static override examples = [
    // List all subscriptions for a channel
    "$ ably push channels list --channel alerts",
    // Filter by device ID
    "$ ably push channels list --channel alerts --device-id my-device-123",
    // Filter by client ID
    "$ ably push channels list --channel alerts --recipient-client-id user-456",
    // With limit
    "$ ably push channels list --channel alerts --limit 50",
    // JSON output
    "$ ably push channels list --channel alerts --json",
  ];

  static override flags = {
    ...AblyBaseCommand.globalFlags,
    channel: Flags.string({
      description: "Channel name to list subscriptions for",
      required: true,
    }),
    "device-id": Flags.string({
      description: "Filter by device ID",
    }),
    "recipient-client-id": Flags.string({
      description: "Filter by client ID",
    }),
    limit: Flags.integer({
      description: "Maximum number of results (default: 100, max: 1000)",
      default: 100,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushChannelsList);

    try {
      const rest = await this.createAblyRestClient(flags);
      if (!rest) {
        return;
      }

      // Build filter params
      const params: Record<string, string | number> = {
        channel: flags.channel,
        limit: Math.min(flags.limit, 1000),
      };

      if (flags["device-id"]) {
        params.deviceId = flags["device-id"];
      }

      if (flags["recipient-client-id"]) {
        params.clientId = flags["recipient-client-id"];
      }

      // List subscriptions
      const result = await rest.push.admin.channelSubscriptions.list(params);
      const subscriptions = result.items;

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              subscriptions: subscriptions.map((sub) => ({
                channel: sub.channel,
                deviceId: sub.deviceId,
                clientId: sub.clientId,
              })),
              count: subscriptions.length,
              success: true,
              timestamp: new Date().toISOString(),
            },
            flags,
          ),
        );
      } else {
        this.log(
          chalk.bold(
            `Push Subscriptions for channel "${flags.channel}" (${subscriptions.length} found)\n`,
          ),
        );

        if (subscriptions.length === 0) {
          this.log(chalk.dim("No subscriptions found."));
          return;
        }

        // Table header
        this.log(`${chalk.dim("TYPE".padEnd(12))}${chalk.dim("ID")}`);
        this.log(chalk.dim("-".repeat(60)));

        // List subscriptions
        for (const sub of subscriptions) {
          if (sub.deviceId) {
            this.log(`${"device".padEnd(12)}${sub.deviceId}`);
          } else if (sub.clientId) {
            this.log(`${"client".padEnd(12)}${sub.clientId}`);
          }
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
        this.error(`Error listing subscriptions: ${errorMessage}`);
      }
    }
  }
}
