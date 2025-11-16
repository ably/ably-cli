import { Args, Flags } from "@oclif/core";
import { OrderBy } from "@ably/chat";
import chalk from "chalk";

import { ChatBaseCommand } from "../../../chat-base-command.js";

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
    '$ ably rooms messages history --api-key "YOUR_API_KEY" my-room',
    "$ ably rooms messages history --limit 50 my-room",
    "$ ably rooms messages history --show-metadata my-room",
    "$ ably rooms messages history my-room --start 1737283200000",
    "$ ably rooms messages history my-room --start 1737283200000 --end 1737286800000",
    "$ ably rooms messages history my-room --order newestFirst",
    "$ ably rooms messages history my-room --json",
    "$ ably rooms messages history my-room --pretty-json",
  ];

  static override flags = {
    ...ChatBaseCommand.globalFlags,
    end: Flags.string({
      description: "End time for the history query (Unix timestamp in ms)",
    }),
    limit: Flags.integer({
      char: "l",
      default: 50,
      description: "Maximum number of messages to retrieve (default: 50)",
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
    start: Flags.string({
      description: "Start time for the history query (Unix timestamp in ms)",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MessagesHistory);

    try {
      // Create Chat client
      const chatClient = await this.createChatClient(flags);

      if (!chatClient) {
        this.error("Failed to create Chat client");
        return;
      }

      // Get the room
      const room = await chatClient.rooms.get(args.room);

      // Attach to the room
      await room.attach();

      if (!this.shouldSuppressOutput(flags)) {
        if (this.shouldOutputJson(flags)) {
          this.log(
            this.formatJsonOutput(
              {
                limit: flags.limit,
                room: args.room,
                status: "fetching",
                success: true,
              },
              flags,
            ),
          );
        } else {
          this.log(
            `${chalk.green("Fetching")} ${chalk.yellow(flags.limit.toString())} ${chalk.green("most recent messages from room:")} ${chalk.bold(args.room)}`,
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
        const startTime = /^\d+$/.test(flags.start)
          ? Number.parseInt(flags.start, 10)
          : new Date(flags.start).getTime();
        historyParams.start = startTime;
      }

      if (flags.end) {
        const endTime = /^\d+$/.test(flags.end)
          ? Number.parseInt(flags.end, 10)
          : new Date(flags.end).getTime();
        historyParams.end = endTime;
      }

      // Get historical messages
      const messagesResult = await room.messages.history(historyParams);
      const { items } = messagesResult;

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              messages: items.map((message) => ({
                clientId: message.clientId,
                text: message.text,
                timestamp: message.timestamp,
                ...(flags["show-metadata"] && message.metadata
                  ? { metadata: message.metadata }
                  : {}),
              })),
              room: args.room,
              success: true,
            },
            flags,
          ),
        );
      } else {
        // Display messages count
        this.log(
          `${chalk.green("Retrieved")} ${chalk.yellow(items.length.toString())} ${chalk.green("messages.")}`,
        );

        if (items.length === 0) {
          this.log(chalk.dim("No messages found in this room."));
        } else {
          this.log(chalk.dim("---"));

          // Display messages in chronological order (oldest first)
          const messagesInOrder = [...items].reverse();
          for (const message of messagesInOrder) {
            // Format message with timestamp, author and content
            const timestamp = new Date(message.timestamp).toLocaleTimeString();
            const author = message.clientId || "Unknown";

            this.log(
              `${chalk.gray(`[${timestamp}]`)} ${chalk.cyan(`${author}:`)} ${message.text}`,
            );

            // Show metadata if enabled and available
            if (flags["show-metadata"] && message.metadata) {
              this.log(
                `${chalk.gray("  Metadata:")} ${chalk.yellow(this.formatJsonOutput(message.metadata, flags))}`,
              );
            }
          }
        }
      }
    } catch (error) {
      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              error: error instanceof Error ? error.message : String(error),
              room: args.room,
              success: false,
            },
            flags,
          ),
        );
        process.exitCode = 1;
      } else {
        this.error(
          `Failed to get messages: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}
