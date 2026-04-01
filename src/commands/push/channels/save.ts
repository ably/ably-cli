import { Flags } from "@oclif/core";

import { AblyBaseCommand } from "../../../base-command.js";
import { productApiFlags } from "../../../flags.js";
import { BaseFlags } from "../../../types/cli.js";
import { formatResource } from "../../../utils/output.js";

export default class PushChannelsSave extends AblyBaseCommand {
  static override description =
    "Subscribe a device or client to push notifications on a channel";

  static override examples = [
    "<%= config.bin %> <%= command.id %> --channel my-channel --device-id device-123",
    "<%= config.bin %> <%= command.id %> --channel my-channel --client-id client-1",
    "<%= config.bin %> <%= command.id %> --channel my-channel --device-id device-123 --json",
  ];

  static override flags = {
    ...productApiFlags,
    channel: Flags.string({
      description: "Channel name to subscribe to",
      required: true,
    }),
    "device-id": Flags.string({
      description: "Device ID to subscribe",
      exclusive: ["client-id"],
    }),
    "client-id": Flags.string({
      description: "Client ID to subscribe",
      exclusive: ["device-id"],
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushChannelsSave);

    if (!flags["device-id"] && !flags["client-id"]) {
      this.fail(
        "Either --device-id or --client-id must be provided",
        flags as BaseFlags,
        "pushChannelSave",
      );
    }

    try {
      const rest = await this.createAblyRestClient(flags as BaseFlags);
      if (!rest) return;

      this.logProgress(
        `Subscribing to channel ${formatResource(flags.channel)}`,
        flags,
      );

      const subscription: Record<string, string> = {
        channel: flags.channel,
      };
      if (flags["device-id"]) subscription.deviceId = flags["device-id"];
      if (flags["client-id"]) subscription.clientId = flags["client-id"];

      await rest.push.admin.channelSubscriptions.save(subscription as never);

      const target = flags["device-id"]
        ? `device ${formatResource(flags["device-id"])}`
        : `client ${formatResource(flags["client-id"]!)}`;

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult({ subscription }, flags);
      } else {
        this.logSuccessMessage(
          `Subscribed ${target} to channel ${formatResource(flags.channel)}.`,
          flags,
        );
      }
    } catch (error) {
      this.fail(error, flags as BaseFlags, "pushChannelSave");
    }
  }
}
