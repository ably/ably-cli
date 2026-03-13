import { Flags } from "@oclif/core";

import { AblyBaseCommand } from "../../../base-command.js";
import { productApiFlags } from "../../../flags.js";
import { BaseFlags } from "../../../types/cli.js";
import {
  formatClientId,
  formatCountLabel,
  formatHeading,
  formatLabel,
  formatLimitWarning,
  formatProgress,
  formatResource,
  formatSuccess,
  formatWarning,
} from "../../../utils/output.js";
import {
  collectPaginatedResults,
  formatPaginationWarning,
} from "../../../utils/pagination.js";

export default class PushChannelsList extends AblyBaseCommand {
  static override description = "List push channel subscriptions";

  static override examples = [
    "<%= config.bin %> <%= command.id %> --channel my-channel",
    "<%= config.bin %> <%= command.id %> --channel my-channel --device-id device-123",
    "<%= config.bin %> <%= command.id %> --channel my-channel --json",
  ];

  static override flags = {
    ...productApiFlags,
    channel: Flags.string({
      description: "Channel name to list subscriptions for",
      required: true,
    }),
    "device-id": Flags.string({
      description: "Filter by device ID",
    }),
    "client-id": Flags.string({
      description: "Filter by client ID",
    }),
    limit: Flags.integer({
      description: "Maximum number of results to return (default: 100)",
      default: 100,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushChannelsList);

    try {
      const rest = await this.createAblyRestClient(flags as BaseFlags);
      if (!rest) return;

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Fetching subscriptions for channel ${formatResource(flags.channel)}`,
          ),
        );
      }

      const params: Record<string, string | number> = {
        channel: flags.channel,
        limit: flags.limit,
      };
      if (flags["device-id"]) params.deviceId = flags["device-id"];
      if (flags["client-id"]) params.clientId = flags["client-id"];

      const result = await rest.push.admin.channelSubscriptions.list(params);
      const {
        items: subscriptions,
        hasMore,
        pagesConsumed,
      } = await collectPaginatedResults(result, flags.limit);

      const paginationWarning = formatPaginationWarning(
        pagesConsumed,
        subscriptions.length,
      );
      if (paginationWarning && !this.shouldOutputJson(flags)) {
        this.logToStderr(paginationWarning);
      }

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult({ subscriptions, hasMore }, flags);
        return;
      }

      if (subscriptions.length === 0) {
        this.logToStderr(formatWarning("No subscriptions found."));
        return;
      }

      this.log(
        formatSuccess(
          `Found ${formatCountLabel(subscriptions.length, "subscription")}.`,
        ),
      );
      this.log("");

      for (const sub of subscriptions) {
        const type = sub.deviceId ? "device" : "client";
        const id = sub.deviceId || sub.clientId || "unknown";
        this.log(formatHeading(`${type}: ${id}`));
        this.log(`  ${formatLabel("Channel")} ${formatResource(sub.channel)}`);
        if (sub.deviceId)
          this.log(`  ${formatLabel("Device ID")} ${sub.deviceId}`);
        if (sub.clientId)
          this.log(
            `  ${formatLabel("Client ID")} ${formatClientId(sub.clientId)}`,
          );
        this.log("");
      }

      if (hasMore) {
        const limitWarning = formatLimitWarning(
          subscriptions.length,
          flags.limit,
          "subscriptions",
        );
        if (limitWarning) this.logToStderr(limitWarning);
      }
    } catch (error) {
      this.fail(error, flags as BaseFlags, "pushChannelList");
    }
  }
}
