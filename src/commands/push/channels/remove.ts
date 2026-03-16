import { Flags } from "@oclif/core";
import inquirer from "inquirer";

import { AblyBaseCommand } from "../../../base-command.js";
import { forceFlag, productApiFlags } from "../../../flags.js";
import { BaseFlags } from "../../../types/cli.js";
import {
  formatProgress,
  formatResource,
  formatSuccess,
} from "../../../utils/output.js";

export default class PushChannelsRemove extends AblyBaseCommand {
  static override description = "Remove a push channel subscription";

  static override examples = [
    "<%= config.bin %> <%= command.id %> --channel my-channel --device-id device-123",
    "<%= config.bin %> <%= command.id %> --channel my-channel --client-id client-1 --force",
    "<%= config.bin %> <%= command.id %> --channel my-channel --device-id device-123 --json",
  ];

  static override flags = {
    ...productApiFlags,
    channel: Flags.string({
      description: "Channel name to unsubscribe from",
      required: true,
    }),
    "device-id": Flags.string({
      description: "Device ID to unsubscribe",
      exclusive: ["client-id"],
    }),
    "client-id": Flags.string({
      description: "Client ID to unsubscribe",
      exclusive: ["device-id"],
    }),
    ...forceFlag,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushChannelsRemove);

    if (!flags["device-id"] && !flags["client-id"]) {
      this.fail(
        "Either --device-id or --client-id must be provided",
        flags as BaseFlags,
        "pushChannelRemove",
      );
    }

    try {
      const rest = await this.createAblyRestClient(flags as BaseFlags);
      if (!rest) return;

      const target = flags["device-id"]
        ? `device ${flags["device-id"]}`
        : `client ${flags["client-id"]}`;

      if (!flags.force && !this.shouldOutputJson(flags)) {
        const { confirmed } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirmed",
            message: `Are you sure you want to unsubscribe ${target} from channel ${flags.channel}?`,
            default: false,
          },
        ]);

        if (!confirmed) {
          this.log("Operation cancelled.");
          return;
        }
      }

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Removing subscription from channel ${formatResource(flags.channel)}`,
          ),
        );
      }

      const subscription: Record<string, string> = {
        channel: flags.channel,
      };
      if (flags["device-id"]) subscription.deviceId = flags["device-id"];
      if (flags["client-id"]) subscription.clientId = flags["client-id"];

      await rest.push.admin.channelSubscriptions.remove(subscription as never);

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          { removed: true, channel: flags.channel, ...subscription },
          flags,
        );
      } else {
        this.log(
          formatSuccess(
            `Subscription removed from channel ${formatResource(flags.channel)}.`,
          ),
        );
      }
    } catch (error) {
      this.fail(error, flags as BaseFlags, "pushChannelRemove");
    }
  }
}
