import { Flags } from "@oclif/core";

import { AblyBaseCommand } from "../../../base-command.js";
import { productApiFlags } from "../../../flags.js";
import {
  formatCountLabel,
  formatLimitWarning,
  formatResource,
} from "../../../utils/output.js";
import {
  buildPaginationNext,
  collectPaginatedResults,
  formatPaginationLog,
} from "../../../utils/pagination.js";

export default class PushChannelsListChannels extends AblyBaseCommand {
  static override description = "List channels with push subscriptions";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --limit 50",
    "<%= config.bin %> <%= command.id %> --json",
  ];

  static override flags = {
    ...productApiFlags,
    limit: Flags.integer({
      description: "Maximum number of results to return",
      default: 100,
      min: 1,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushChannelsListChannels);

    try {
      const rest = await this.createAblyRestClient(flags);
      if (!rest) return;

      this.logProgress("Fetching channels with push subscriptions", flags);

      const result = await rest.push.admin.channelSubscriptions.listChannels({
        limit: flags.limit,
      });
      const {
        items: channels,
        hasMore,
        pagesConsumed,
      } = await collectPaginatedResults(result, flags.limit);

      const paginationWarning = formatPaginationLog(
        pagesConsumed,
        channels.length,
      );
      if (paginationWarning && !this.shouldOutputJson(flags)) {
        this.logToStderr(paginationWarning);
      }

      if (this.shouldOutputJson(flags)) {
        const next = buildPaginationNext(hasMore);
        this.logJsonResult({ channels, hasMore, ...(next && { next }) }, flags);
        return;
      }

      if (channels.length === 0) {
        this.log("No channels with push subscriptions found.");
        return;
      }

      this.logSuccessMessage(
        `Found ${formatCountLabel(channels.length, "channel")}.`,
        flags,
      );
      this.log("");

      for (const channel of channels) {
        this.log(`  ${formatResource(channel)}`);
      }
      this.log("");

      if (hasMore) {
        const limitWarning = formatLimitWarning(
          channels.length,
          flags.limit,
          "channels",
        );
        if (limitWarning) this.logToStderr(limitWarning);
      }
    } catch (error) {
      this.fail(error, flags, "pushChannelListChannels");
    }
  }
}
