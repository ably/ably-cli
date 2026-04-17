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
  formatResource,
} from "../../../utils/output.js";
import {
  buildPaginationNext,
  collectPaginatedResults,
  formatPaginationLog,
} from "../../../utils/pagination.js";

// Chat SDK maps room presence to the underlying channel: roomName::$chat
const chatChannelName = (roomName: string) => `${roomName}::$chat`;

export default class RoomsPresenceGet extends AblyBaseCommand {
  static override args = {
    roomName: Args.string({
      description: "Room to get presence members for",
      required: true,
    }),
  };

  static override description =
    "Get all current presence members in a chat room";

  static override examples = [
    "$ ably rooms presence get my-room",
    "$ ably rooms presence get my-room --limit 50",
    "$ ably rooms presence get my-room --json",
    "$ ably rooms presence get my-room --pretty-json",
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
    const { args, flags } = await this.parse(RoomsPresenceGet);

    try {
      const client = await this.createAblyRestClient(flags);
      if (!client) return;

      const { roomName } = args;
      const channelName = chatChannelName(roomName);

      this.logProgress(
        `Fetching presence members for room: ${formatResource(roomName)}`,
        flags,
      );

      this.logCliEvent(
        flags,
        "presence",
        "fetching",
        `Fetching presence members for room ${formatResource(roomName)}`,
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
        this.logToStderr(paginationWarning);
      }

      if (this.shouldOutputJson(flags)) {
        const presenceMembers = items.map((member) => ({
          clientId: member.clientId,
          connectionId: member.connectionId,
          action: member.action,
          data: (member.data as unknown) ?? null,
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
        this.logWarning("No members currently present in this room.", flags);
      } else {
        this.log(
          `\n${formatHeading(`Presence members in room: ${formatResource(roomName)}`)} (${formatCountLabel(items.length, "member")}):\n`,
        );

        for (const [i, member] of items.entries()) {
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
          if (warning) this.logToStderr(warning);
        }
      }
    } catch (error) {
      this.fail(error, flags, "roomPresenceGet", {
        room: args.roomName,
      });
    }
  }
}
