import { Flags } from "@oclif/core";

import { AblyBaseCommand } from "../../../base-command.js";
import { forceFlag, productApiFlags } from "../../../flags.js";
import { BaseFlags } from "../../../types/cli.js";
import { formatResource } from "../../../utils/output.js";
import { promptForConfirmation } from "../../../utils/prompt-confirmation.js";

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

      // In JSON mode, require --force to prevent accidental destructive actions
      if (!flags.force && this.shouldOutputJson(flags)) {
        this.fail(
          "The --force flag is required when using --json to confirm removal",
          flags,
          "pushChannelRemoveWhere",
        );
      }

      if (!flags.force && !this.shouldOutputJson(flags)) {
        const filterDesc = Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ");

        const confirmed = await promptForConfirmation(
          `Are you sure you want to remove all subscriptions matching: ${filterDesc}?`,
        );

        if (!confirmed) {
          this.logWarning("Operation cancelled.", flags);
          return;
        }
      }

      this.logProgress(
        `Removing matching subscriptions from channel ${formatResource(flags.channel)}`,
        flags,
      );

      await rest.push.admin.channelSubscriptions.removeWhere(params);

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          { subscriptions: { removed: true, filters: params } },
          flags,
        );
      } else {
        this.logSuccessMessage("Matching subscriptions removed.", flags);
      }
    } catch (error) {
      this.fail(error, flags as BaseFlags, "pushChannelRemoveWhere");
    }
  }
}
