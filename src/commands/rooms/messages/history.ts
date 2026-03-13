import { Args, Flags } from "@oclif/core";
import { OrderBy } from "@ably/chat";
import chalk from "chalk";

import { ChatBaseCommand } from "../../../chat-base-command.js";
import { productApiFlags, timeRangeFlags } from "../../../flags.js";
import {
  formatLabel,
  formatLimitWarning,
  formatProgress,
  formatSuccess,
  formatResource,
  formatTimestamp,
  formatMessageTimestamp,
} from "../../../utils/output.js";
import {
  collectPaginatedResults,
  formatPaginationWarning,
} from "../../../utils/pagination.js";
import { parseTimestamp } from "../../../utils/time.js";

export default class MessagesHistory extends ChatBaseCommand {
  static override args = {
    room: Args.string({
      description: "The room to get message history from",
      required: true,
    }),
  };

  static override description =
    "Get historical messages from an Ably Chat room";

  static override examples = [
    "$ ably rooms messages history my-room",
    '$ ABLY_API_KEY="YOUR_API_KEY" ably rooms messages history my-room',
    "$ ably rooms messages history --limit 50 my-room",
    "$ ably rooms messages history --show-metadata my-room",
    '$ ably rooms messages history my-room --start "2025-01-01T00:00:00Z"',
    '$ ably rooms messages history my-room --start "2025-01-01T00:00:00Z" --end "2025-01-02T00:00:00Z"',
    "$ ably rooms messages history my-room --start 1h",
    "$ ably rooms messages history my-room --order newestFirst",
    "$ ably rooms messages history my-room --json",
    "$ ably rooms messages history my-room --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
    ...timeRangeFlags,
    limit: Flags.integer({
      char: "l",
      default: 50,
      description: "Maximum number of results to return (default: 50)",
    }),
    order: Flags.string({
      default: "newestFirst",
      description:
        "Query direction: oldestFirst or newestFirst (default: newestFirst)",
      options: ["oldestFirst", "newestFirst"],
    }),
    "show-metadata": Flags.boolean({
      default: false,
      description: "Display message metadata if available",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MessagesHistory);

    try {
      // Create Chat client
      const chatClient = await this.createChatClient(flags);

      if (!chatClient) {
        this.fail("Failed to create Chat client", flags, "roomMessageHistory");
      }

      // Get the room
      const room = await chatClient.rooms.get(args.room);

      // Attach to the room
      await room.attach();

      if (!this.shouldSuppressOutput(flags)) {
        if (this.shouldOutputJson(flags)) {
          this.logJsonEvent(
            {
              limit: flags.limit,
              room: args.room,
              status: "fetching",
            },
            flags,
          );
        } else {
          this.log(
            formatProgress(
              `Fetching ${flags.limit} most recent messages from room ${formatResource(args.room)}`,
            ),
          );
        }
      }

      // Build history query parameters
      const historyParams: {
        limit: number;
        orderBy?: OrderBy;
        start?: number;
        end?: number;
      } = {
        limit: flags.limit,
        orderBy:
          flags.order === "newestFirst"
            ? OrderBy.NewestFirst
            : OrderBy.OldestFirst,
      };

      // Add time range if specified
      if (flags.start) {
        historyParams.start = parseTimestamp(flags.start, "start");
      }

      if (flags.end) {
        historyParams.end = parseTimestamp(flags.end, "end");
      }

      if (
        historyParams.start !== undefined &&
        historyParams.end !== undefined &&
        historyParams.start > historyParams.end
      ) {
        this.fail(
          "--start must be earlier than or equal to --end",
          flags,
          "roomMessageHistory",
          { room: args.room },
        );
      }

      // Get historical messages
      const messagesResult = await room.messages.history(historyParams);
      const { items, hasMore, pagesConsumed } = await collectPaginatedResults(
        messagesResult,
        flags.limit,
      );

      const paginationWarning = formatPaginationWarning(
        pagesConsumed,
        items.length,
      );
      if (paginationWarning && !this.shouldOutputJson(flags)) {
        this.logToStderr(paginationWarning);
      }

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            hasMore,
            messages: items.map((message) => ({
              clientId: message.clientId,
              text: message.text,
              timestamp: message.timestamp,
              ...(flags["show-metadata"] && message.metadata
                ? { metadata: message.metadata }
                : {}),
            })),
            room: args.room,
          },
          flags,
        );
      } else {
        // Display messages count
        this.log(formatSuccess(`Retrieved ${items.length} messages.`));

        if (items.length === 0) {
          this.log(chalk.dim("No messages found in this room."));
        } else {
          this.log(chalk.dim("---"));

          // Display messages in order provided
          const messagesInOrder = [...items];
          for (const message of messagesInOrder) {
            // Format message with timestamp, author and content
            const timestamp = formatMessageTimestamp(message.timestamp);
            const author = message.clientId || "Unknown";

            this.log(
              `${formatTimestamp(timestamp)} ${chalk.blue(`${author}:`)} ${message.text}`,
            );

            // Show metadata if enabled and available
            if (flags["show-metadata"] && message.metadata) {
              this.log(
                `  ${formatLabel("Metadata")} ${chalk.yellow(this.formatJsonOutput(message.metadata, flags))}`,
              );
            }
          }
        }

        if (hasMore) {
          const warning = formatLimitWarning(
            items.length,
            flags.limit,
            "messages",
          );
          if (warning) this.logToStderr(warning);
        }
      }
    } catch (error) {
      this.fail(error, flags, "roomMessageHistory", { room: args.room });
    }
  }
}
