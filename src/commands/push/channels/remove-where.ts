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

export default class PushChannelsRemoveWhere extends AblyBaseCommand {
  static override description =
    "Remove push channel subscriptions matching filter criteria";

  static override examples = [
    "<%= config.bin %> <%= command.id %> --channel my-channel",
    "<%= config.bin %> <%= command.id %> --channel my-channel --device-id device-123 --force",
    "<%= config.bin %> <%= command.id %> --channel my-channel --json",
  ];

  static override flags = {
    ...productApiFlags,
    channel: Flags.string({
      description: "Channel name to filter by",
      required: true,
    }),
    "device-id": Flags.string({
      description: "Filter by device ID",
    }),
    "client-id": Flags.string({
      description: "Filter by client ID",
    }),
    ...forceFlag,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushChannelsRemoveWhere);

    try {
      const rest = await this.createAblyRestClient(flags as BaseFlags);
      if (!rest) return;

      const params: Record<string, string> = {
        channel: flags.channel,
      };
      if (flags["device-id"]) params.deviceId = flags["device-id"];
      if (flags["client-id"]) params.clientId = flags["client-id"];

      if (!flags.force && !this.shouldOutputJson(flags)) {
        const filterDesc = Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ");

        const { confirmed } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirmed",
            message: `Are you sure you want to remove all subscriptions matching: ${filterDesc}?`,
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
            `Removing matching subscriptions from channel ${formatResource(flags.channel)}`,
          ),
        );
      }

      await rest.push.admin.channelSubscriptions.removeWhere(params);

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult({ removed: true, filters: params }, flags);
      } else {
        this.log(formatSuccess("Matching subscriptions removed."));
      }
    } catch (error) {
      this.fail(error, flags as BaseFlags, "pushChannelRemoveWhere");
    }
  }
}
