import { Args, Flags } from "@oclif/core";

import { AblyBaseCommand } from "../../../base-command.js";
import { forceFlag, productApiFlags } from "../../../flags.js";
import { BaseFlags } from "../../../types/cli.js";
import { formatResource } from "../../../utils/output.js";
import { promptForConfirmation } from "../../../utils/prompt-confirmation.js";

export default class PushChannelsRemove extends AblyBaseCommand {
  static override description = "Remove a push channel subscription";

  static override args = {
    channelName: Args.string({
      description: "Channel name to unsubscribe from",
      required: true,
    }),
  };

  static override examples = [
    '<%= config.bin %> <%= command.id %> "my-channel" --device-id device-123',
    '<%= config.bin %> <%= command.id %> "my-channel" --client-id client-1 --force',
    '<%= config.bin %> <%= command.id %> "my-channel" --device-id device-123 --json',
  ];

  static override flags = {
    ...productApiFlags,
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
    const { args, flags } = await this.parse(PushChannelsRemove);

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

      // In JSON mode, require --force to prevent accidental destructive actions
      if (!flags.force && this.shouldOutputJson(flags)) {
        this.fail(
          "The --force flag is required when using --json to confirm removal",
          flags,
          "pushChannelRemove",
        );
      }

      if (!flags.force && !this.shouldOutputJson(flags)) {
        const confirmed = await promptForConfirmation(
          `Are you sure you want to unsubscribe ${target} from channel ${args.channelName}?`,
        );

        if (!confirmed) {
          this.logWarning("Operation cancelled.", flags);
          return;
        }
      }

      this.logProgress(
        `Removing subscription from channel ${formatResource(args.channelName)}`,
        flags,
      );

      const subscription: Record<string, string> = {
        channel: args.channelName,
      };
      if (flags["device-id"]) subscription.deviceId = flags["device-id"];
      if (flags["client-id"]) subscription.clientId = flags["client-id"];

      await rest.push.admin.channelSubscriptions.remove(subscription as never);

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            subscription: {
              removed: true,
              channel: args.channelName,
              ...subscription,
            },
          },
          flags,
        );
      } else {
        this.logSuccessMessage(
          `Subscription removed from channel ${formatResource(args.channelName)}.`,
          flags,
        );
      }
    } catch (error) {
      this.fail(error, flags as BaseFlags, "pushChannelRemove");
    }
  }
}
