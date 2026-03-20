import { Args, Flags } from "@oclif/core";

import { AblyBaseCommand } from "../../../base-command.js";
import { productApiFlags } from "../../../flags.js";
import {
  formatClientId,
  formatCountLabel,
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

// Chat SDK maps room presence to the underlying channel: roomName::$chat
const chatChannelName = (roomName: string) => `${roomName}::$chat`;

export default class RoomsPresenceGetAll extends AblyBaseCommand {
  static override args = {
    room: Args.string({
      description: "Room to get presence members for",
      required: true,
    }),
  };

  static override description =
    "Get all current presence members in a chat room";

  static override examples = [
    "$ ably rooms presence get-all my-room",
    "$ ably rooms presence get-all my-room --limit 50",
    "$ ably rooms presence get-all my-room --json",
    "$ ably rooms presence get-all my-room --pretty-json",
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
    const { args, flags } = await this.parse(RoomsPresenceGetAll);

    try {
      const client = await this.createAblyRestClient(flags);
      if (!client) return;

      const { room: roomName } = args;
      const channelName = chatChannelName(roomName);

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Fetching presence members for room: ${formatResource(roomName)}`,
          ),
        );
      }

      this.logCliEvent(
        flags,
        "presence",
        "fetching",
        `Fetching presence members for room ${roomName}`,
        { room: roomName },
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
        { room: roomName, count: items.length },
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
          data: member.data ?? null,
          extras: member.extras ?? null,
          updatedAt: formatMessageTimestamp(member.timestamp),
        }));
        const next = buildPaginationNext(hasMore);
        this.logJsonResult(
          {
            presenceMembers,
            hasMore,
            ...(next && { next }),
            total: items.length,
          },
          flags,
        );
      } else if (items.length === 0) {
        this.logToStderr(
          formatWarning("No members currently present in this room."),
        );
      } else {
        this.log(
          `\n${formatHeading(`Presence members in room: ${roomName}`)} (${formatCountLabel(items.length, "member")}):\n`,
        );

        for (let i = 0; i < items.length; i++) {
          const member = items[i];
          this.log(`${formatIndex(i + 1)}`);
          this.log(
            `  ${formatLabel("Client ID")} ${formatClientId(member.clientId)}`,
          );
          this.log(`  ${formatLabel("Connection ID")} ${member.connectionId}`);
          if (member.data !== null && member.data !== undefined) {
            this.log(`  ${formatLabel("Data")} ${JSON.stringify(member.data)}`);
          }
          if (
            member.extras !== null &&
            member.extras !== undefined &&
            typeof member.extras === "object" &&
            Object.keys(member.extras).length > 0
          ) {
            this.log(
              `  ${formatLabel("Extras")} ${JSON.stringify(member.extras)}`,
            );
          }
          this.log(
            `  ${formatLabel("Updated At")} ${formatMessageTimestamp(member.timestamp)}`,
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
      this.fail(error, flags, "roomPresenceGetAll", {
        room: args.room,
      });
    }
  }
}
