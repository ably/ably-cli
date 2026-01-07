import { Flags } from "@oclif/core";
import { AblyBaseCommand } from "../../../base-command.js";
import * as Ably from "ably";
import chalk from "chalk";

export default class PushChannelsRemove extends AblyBaseCommand {
  static override description =
    "Remove a push channel subscription (maps to push.admin.channelSubscriptions.remove)";

  static override examples = [
    // Remove device subscription
    "$ ably push channels remove --channel alerts --device-id my-device-123",
    // Remove client subscription
    "$ ably push channels remove --channel alerts --recipient-client-id user-456",
    // With force flag
    "$ ably push channels remove --channel alerts --device-id my-device-123 --force",
    // JSON output
    "$ ably push channels remove --channel alerts --device-id my-device-123 --json",
  ];

  static override flags = {
    ...AblyBaseCommand.globalFlags,
    channel: Flags.string({
      description: "Channel to unsubscribe from",
      required: true,
    }),
    "device-id": Flags.string({
      description: "Device ID to unsubscribe",
    }),
    "recipient-client-id": Flags.string({
      description: "Client ID to unsubscribe",
    }),
    force: Flags.boolean({
      char: "f",
      default: false,
      description: "Skip confirmation prompt",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushChannelsRemove);

    // Validate that either device-id or recipient-client-id is provided
    if (!flags["device-id"] && !flags["recipient-client-id"]) {
      this.error(
        "Either --device-id or --recipient-client-id must be specified",
      );
    }

    if (flags["device-id"] && flags["recipient-client-id"]) {
      this.error(
        "Only one of --device-id or --recipient-client-id can be specified, not both",
      );
    }

    try {
      const rest = await this.createAblyRestClient(flags);
      if (!rest) {
        return;
      }

      const subscriberId = flags["device-id"] || flags["recipient-client-id"];
      const subscriberType = flags["device-id"] ? "device" : "client";

      // Confirm deletion unless --force is used
      if (!flags.force && !this.shouldOutputJson(flags)) {
        const { default: inquirer } = await import("inquirer");
        const { confirmed } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirmed",
            message: `Are you sure you want to unsubscribe ${subscriberType} ${chalk.cyan(subscriberId)} from channel ${chalk.cyan(flags.channel)}?`,
            default: false,
          },
        ]);

        if (!confirmed) {
          this.log("Operation cancelled.");
          return;
        }
      }

      // Build subscription object for removal
      const subscription: Ably.PushChannelSubscription = {
        channel: flags.channel,
      };

      if (flags["device-id"]) {
        subscription.deviceId = flags["device-id"];
      } else if (flags["recipient-client-id"]) {
        subscription.clientId = flags["recipient-client-id"];
      }

      // Remove the subscription
      await rest.push.admin.channelSubscriptions.remove(subscription);

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              channel: flags.channel,
              deviceId: flags["device-id"],
              clientId: flags["recipient-client-id"],
              removed: true,
              success: true,
              timestamp: new Date().toISOString(),
            },
            flags,
          ),
        );
      } else {
        this.log(
          chalk.green(
            `Subscription removed successfully: ${subscriberType} ${subscriberId} from channel ${flags.channel}`,
          ),
        );
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
        if (errorCode === 40400) {
          this.error(`Subscription not found`);
        } else {
          this.error(`Error removing subscription: ${errorMessage}`);
        }
      }
    }
  }
}
