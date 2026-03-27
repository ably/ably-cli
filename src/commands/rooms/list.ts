import { Flags } from "@oclif/core";
import { ChatBaseCommand } from "../../chat-base-command.js";
import { productApiFlags } from "../../flags.js";
import {
  formatCountLabel,
  formatLimitWarning,
  formatResource,
  formatLabel,
} from "../../utils/output.js";
import {
  buildPaginationNext,
  collectFilteredPaginatedResults,
  formatPaginationLog,
} from "../../utils/pagination.js";

// Add interface definitions at the beginning of the file
interface RoomMetrics {
  connections?: number;
  presenceConnections?: number;
  presenceMembers?: number;
  publishers?: number;
  subscribers?: number;
}

interface RoomStatus {
  occupancy?: {
    metrics?: RoomMetrics;
  };
}

interface RoomItem {
  channelId: string;
  room: string;
  status?: RoomStatus;
  [key: string]: unknown;
}

interface RoomListParams {
  limit: number;
  prefix?: string;
}

export default class RoomsList extends ChatBaseCommand {
  static override description = "List active chat rooms";

  static override examples = [
    "$ ably rooms list",
    "$ ably rooms list --prefix my-room",
    "$ ably rooms list --limit 50",
    "$ ably rooms list --json",
    "$ ably rooms list --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
    limit: Flags.integer({
      default: 100,
      description: "Maximum number of results to return",
      min: 1,
    }),
    prefix: Flags.string({
      char: "p",
      description: "Filter rooms by prefix",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(RoomsList);

    try {
      // REST client for channel enumeration
      const rest = await this.createAblyRestClient(flags);
      if (!rest) return;

      // Build params for channel listing
      // Request 5x the user's limit (capped at the API max of 1000) because
      // client-side filtering (only ::$chat channels, deduplicated by room name)
      // yields ~1 room per 3-5 raw channels. This minimizes API round trips.
      // collectFilteredPaginatedResults fetches additional pages if still needed.
      const params: RoomListParams = {
        limit: Math.min(flags.limit * 5, 1000),
      };

      if (flags.prefix) {
        params.prefix = flags.prefix;
      }

      // Fetch channels
      const channelsResponse = await rest.request(
        "get",
        "/channels",
        2,
        params,
        null,
      );

      if (channelsResponse.statusCode !== 200) {
        this.fail(
          `Failed to list rooms: ${channelsResponse.statusCode}`,
          flags,
          "roomList",
        );
      }

      // Use filtered pagination to collect chat channels, deduplicate by room name
      const seenRooms = new Set<string>();
      const {
        items: limitedRooms,
        hasMore,
        pagesConsumed,
      } = await collectFilteredPaginatedResults<RoomItem>(
        channelsResponse,
        flags.limit,
        (channel: RoomItem) => {
          const { channelId } = channel;
          if (!channelId.includes("::$chat")) return false;
          const roomNameMatch = channelId.match(/^(.+?)::\$chat.*$/);
          if (!roomNameMatch || !roomNameMatch[1]) return false;
          const roomName = roomNameMatch[1];
          // Apply prefix filter at the room name level, not just the channel level.
          // The server-side prefix filter operates on channel IDs (e.g., "prefix::$chat::messages"),
          // but we need to verify the extracted room name itself starts with the user's prefix.
          if (flags.prefix && !roomName.startsWith(flags.prefix)) return false;
          if (seenRooms.has(roomName)) return false;
          seenRooms.add(roomName);
          return true;
        },
      );

      // Normalize names in a separate step (keep filter as pure predicate)
      const rooms = limitedRooms.map((r) => {
        const match = r.channelId.match(/^(.+?)::\$chat.*$/)!;
        return { ...r, channelId: match[1], room: match[1] };
      });

      const paginationWarning = formatPaginationLog(
        pagesConsumed,
        rooms.length,
      );
      if (paginationWarning && !this.shouldOutputJson(flags)) {
        this.log(paginationWarning);
      }

      // Output rooms based on format
      if (this.shouldOutputJson(flags)) {
        const next = buildPaginationNext(hasMore);
        this.logJsonResult({ rooms, hasMore, ...(next && { next }) }, flags);
      } else {
        if (rooms.length === 0) {
          this.log("No active chat rooms found.");
          return;
        }

        this.log(
          `Found ${formatCountLabel(rooms.length, "active chat room")}:`,
        );

        for (const room of rooms) {
          this.log(`${formatResource(room.room)}`);

          // Show occupancy if available
          if (room.status?.occupancy?.metrics) {
            const { metrics } = room.status.occupancy;
            this.log(
              `  ${formatLabel("Connections")} ${metrics.connections || 0}`,
            );
            this.log(
              `  ${formatLabel("Publishers")} ${metrics.publishers || 0}`,
            );
            this.log(
              `  ${formatLabel("Subscribers")} ${metrics.subscribers || 0}`,
            );

            if (metrics.presenceConnections !== undefined) {
              this.log(
                `  ${formatLabel("Presence Connections")} ${metrics.presenceConnections}`,
              );
            }

            if (metrics.presenceMembers !== undefined) {
              this.log(
                `  ${formatLabel("Presence Members")} ${metrics.presenceMembers}`,
              );
            }
          }

          this.log(""); // Add a line break between rooms
        }

        if (hasMore) {
          const warning = formatLimitWarning(
            rooms.length,
            flags.limit,
            "rooms",
          );
          if (warning) this.log(warning);
        }
      }
    } catch (error) {
      this.fail(error, flags, "roomList");
    }
  }
}
