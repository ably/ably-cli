import { Args, Flags } from "@oclif/core";
import { AblyBaseCommand } from "../../../base-command.js";
import { productApiFlags } from "../../../flags.js";
import {
  formatClientId,
  formatCountLabel,
  formatEventType,
  formatHeading,
  formatIndex,
  formatLabel,
  formatLimitWarning,
  formatMessageTimestamp,
  formatProgress,
  formatResource,
  formatWarning,
} from "../../../utils/output.js";
import {
  buildPaginationNext,
  collectPaginatedResults,
  formatPaginationLog,
} from "../../../utils/pagination.js";

export default class ChannelsPresenceGet extends AblyBaseCommand {
  static override args = {
    channel: Args.string({
      description: "Channel name to get presence members for",
      required: true,
    }),
  };

  static override description = "Get all current presence members on a channel";

  static override examples = [
    "$ ably channels presence get my-channel",
    "$ ably channels presence get my-channel --limit 50",
    "$ ably channels presence get my-channel --json",
    "$ ably channels presence get my-channel --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
    limit: Flags.integer({
      default: 100,
      description: "Maximum number of results to return",
      min: 1,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelsPresenceGet);

    try {
      const client = await this.createAblyRestClient(flags);
      if (!client) return;

      const channelName = args.channel;

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Fetching presence members for channel: ${formatResource(channelName)}`,
          ),
        );
      }

      this.logCliEvent(
        flags,
        "presence",
        "fetching",
        `Fetching presence members for channel ${channelName}`,
        { channel: channelName },
      );

      const firstPage = await client.channels
        .get(channelName)
        .presence.get({ limit: flags.limit });

      const { items, hasMore, pagesConsumed } = await collectPaginatedResults(
        firstPage,
        flags.limit,
      );

      this.logCliEvent(
        flags,
        "presence",
        "fetched",
        `Fetched ${items.length} presence members`,
        { channel: channelName, count: items.length },
      );

      // Show pagination warning early (before main output)
      const paginationWarning = formatPaginationLog(
        pagesConsumed,
        items.length,
      );
      if (paginationWarning && !this.shouldOutputJson(flags)) {
        this.log(paginationWarning);
      }

      if (this.shouldOutputJson(flags)) {
        const presenceMembers = items.map((member) => ({
          clientId: member.clientId,
          connectionId: member.connectionId,
          action: member.action,
          data: member.data ?? null,
          timestamp: formatMessageTimestamp(member.timestamp),
          id: member.id,
        }));
        const next = buildPaginationNext(hasMore);
        this.logJsonResult(
          {
            members: presenceMembers,
            hasMore,
            ...(next && { next }),
            total: items.length,
          },
          flags,
        );
      } else if (items.length === 0) {
        this.logToStderr(
          formatWarning("No members currently present on this channel."),
        );
      } else {
        this.log(
          `\n${formatHeading(`Presence members on channel: ${channelName}`)} (${formatCountLabel(items.length, "member")}):\n`,
        );

        for (let i = 0; i < items.length; i++) {
          const member = items[i];
          this.log(`${formatIndex(i + 1)}`);
          this.log(
            `  ${formatLabel("Client ID")} ${formatClientId(member.clientId)}`,
          );
          this.log(`  ${formatLabel("Connection ID")} ${member.connectionId}`);
          this.log(
            `  ${formatLabel("Action")} ${formatEventType(String(member.action))}`,
          );
          if (member.data !== null && member.data !== undefined) {
            this.log(`  ${formatLabel("Data")} ${JSON.stringify(member.data)}`);
          }
          this.log(
            `  ${formatLabel("Timestamp")} ${formatMessageTimestamp(member.timestamp)}`,
          );
          this.log("");
        }

        if (hasMore) {
          const warning = formatLimitWarning(
            items.length,
            flags.limit,
            "members",
          );
          if (warning) this.log(warning);
        }
      }
    } catch (error) {
      this.fail(error, flags, "presenceGet", {
        channel: args.channel,
      });
    }
  }
}
