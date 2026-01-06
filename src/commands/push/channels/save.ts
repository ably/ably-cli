import { Flags } from "@oclif/core";
import { AblyBaseCommand } from "../../../base-command.js";
import * as Ably from "ably";
import chalk from "chalk";

export default class PushChannelsSave extends AblyBaseCommand {
  static override description =
    "Subscribe a device or client to a push-enabled channel (maps to push.admin.channelSubscriptions.save)";

  static override examples = [
    // Subscribe by device ID
    "$ ably push channels save --channel alerts --device-id my-device-123",
    // Subscribe by client ID (subscribes all client's devices)
    "$ ably push channels save --channel notifications --client-id user-456",
    // With JSON output
    "$ ably push channels save --channel alerts --device-id my-device-123 --json",
  ];

  static override flags = {
    ...AblyBaseCommand.globalFlags,
    channel: Flags.string({
      description: "Channel name to subscribe to",
      required: true,
    }),
    "device-id": Flags.string({
      description: "Device ID to subscribe",
    }),
    "client-id": Flags.string({
      description:
        "Client ID to subscribe (subscribes all of the client's devices)",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushChannelsSave);

    // Validate that either device-id or client-id is provided
    if (!flags["device-id"] && !flags["client-id"]) {
      this.error("Either --device-id or --client-id must be specified");
    }

    if (flags["device-id"] && flags["client-id"]) {
      this.error(
        "Only one of --device-id or --client-id can be specified, not both",
      );
    }

    try {
      const rest = await this.createAblyRestClient(flags);
      if (!rest) {
        return;
      }

      // Build subscription object
      const subscription: Ably.PushChannelSubscription = {
        channel: flags.channel,
      };

      if (flags["device-id"]) {
        subscription.deviceId = flags["device-id"];
      } else if (flags["client-id"]) {
        subscription.clientId = flags["client-id"];
      }

      // Save the subscription
      const savedSubscription =
        await rest.push.admin.channelSubscriptions.save(subscription);

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              subscription: {
                channel: savedSubscription.channel,
                deviceId: savedSubscription.deviceId,
                clientId: savedSubscription.clientId,
              },
              success: true,
              timestamp: new Date().toISOString(),
            },
            flags,
          ),
        );
      } else {
        const subscriberId = flags["device-id"]
          ? `device ${chalk.cyan(flags["device-id"])}`
          : `client ${chalk.cyan(flags["client-id"])}`;

        this.log(
          chalk.green(
            `Successfully subscribed ${subscriberId} to channel ${chalk.cyan(flags.channel)}`,
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
      } else {
        if (errorCode === 40100) {
          this.error(
            `Push not enabled for this channel namespace. Configure push rules in the Ably dashboard.`,
          );
        } else if (errorCode === 40400) {
          this.error(
            `Device or client not found. Ensure the device/client is registered first.`,
          );
        } else {
          this.error(`Error saving subscription: ${errorMessage}`);
        }
      }
    }
  }
}
