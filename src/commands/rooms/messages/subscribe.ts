import { Args, Flags } from "@oclif/core";
import { ChatMessageEvent, ChatClient } from "@ably/chat"; // Import ChatClient and StatusSubscription
import chalk from "chalk";

import { ChatBaseCommand } from "../../../chat-base-command.js";
import { waitUntilInterruptedOrTimeout } from "../../../utils/long-running.js";

// Define message interface
interface ChatMessage {
  clientId: string;
  text: string;
  timestamp: number | Date; // Support both timestamp types
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

// Define status change interface
interface StatusChange {
  current: string;
  reason?: {
    message?: string;
    code?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export default class MessagesSubscribe extends ChatBaseCommand {
  static override args = {
    room: Args.string({
      description: "The room to subscribe to messages from",
      required: true,
    }),
  };

  static override description = "Subscribe to messages in an Ably Chat room";

  static override examples = [
    "$ ably rooms messages subscribe my-room",
    '$ ably rooms messages subscribe --api-key "YOUR_API_KEY" my-room',
    "$ ably rooms messages subscribe --show-metadata my-room",
    "$ ably rooms messages subscribe my-room --duration 30",
    "$ ably rooms messages subscribe my-room --json",
    "$ ably rooms messages subscribe my-room --pretty-json",
  ];

  static override flags = {
    ...ChatBaseCommand.globalFlags,
    "show-metadata": Flags.boolean({
      default: false,
      description: "Display message metadata if available",
    }),
    duration: Flags.integer({
      description:
        "Automatically exit after the given number of seconds (0 = run indefinitely)",
      char: "D",
      required: false,
    }),
  };

  private chatClient: ChatClient | null = null;
  private roomName: string | null = null;
  private cleanupInProgress: boolean = false;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MessagesSubscribe);
    this.roomName = args.room; // Store for cleanup
    this.logCliEvent(
      flags,
      "subscribe.run",
      "start",
      `Starting rooms messages subscribe for room: ${this.roomName}`,
    );

    try {
      // Create clients
      this.logCliEvent(
        flags,
        "subscribe.auth",
        "attemptingClientCreation",
        "Attempting to create Chat and Ably clients.",
      );
      // Create Chat client (which also creates the Ably client internally)
      this.chatClient = await this.createChatClient(flags);

      this.logCliEvent(
        flags,
        "subscribe.auth",
        "clientCreationSuccess",
        "Chat and Ably clients created.",
      );

      if (!this.shouldOutputJson(flags)) {
        this.log(`Attaching to room: ${chalk.cyan(this.roomName)}...`);
      }

      if (!this.chatClient) {
        throw new Error("Failed to create Chat or Ably client");
      }

      // Set up connection state logging
      this.setupConnectionStateLogging(this.chatClient.realtime, flags, {
        includeUserFriendlyMessages: true,
      });

      // Get the room
      this.logCliEvent(
        flags,
        "room",
        "gettingRoom",
        `Getting room handle for ${this.roomName}`,
      );
      const room = await this.chatClient.rooms.get(this.roomName, {});
      this.logCliEvent(
        flags,
        "room",
        "gotRoom",
        `Got room handle for ${this.roomName}`,
      );

      // Setup message handler
      this.logCliEvent(
        flags,
        "room",
        "subscribingToMessages",
        `Subscribing to messages in room ${this.roomName}`,
      );
      room.messages.subscribe((messageEvent: ChatMessageEvent) => {
        const { message } = messageEvent;
        const messageLog: ChatMessage = {
          clientId: message.clientId,
          text: message.text,
          timestamp: message.timestamp,
          ...(message.metadata ? { metadata: message.metadata } : {}),
        };
        this.logCliEvent(flags, "message", "received", "Message received", {
          message: messageLog,
          room: this.roomName,
        });

        if (this.shouldOutputJson(flags)) {
          this.log(
            this.formatJsonOutput(
              {
                message: messageLog,
                room: this.roomName,
                success: true,
              },
              flags,
            ),
          );
        } else {
          // Format message with timestamp, author and content
          const timestamp = new Date(message.timestamp).toLocaleTimeString();
          const author = message.clientId || "Unknown";

          // Message content with consistent formatting
          this.log(
            `${chalk.gray(`[${timestamp}]`)} ${chalk.cyan(`${author}:`)} ${message.text}`,
          );

          // Show metadata if enabled and available
          if (flags["show-metadata"] && message.metadata) {
            this.log(
              `${chalk.blue("  Metadata:")} ${chalk.yellow(this.formatJsonOutput(message.metadata, flags))}`,
            );
          }

          this.log(""); // Empty line for better readability
        }
      });
      this.logCliEvent(
        flags,
        "room",
        "subscribedToMessages",
        `Successfully subscribed to messages in room ${this.roomName}`,
      );

      // Subscribe to room status changes
      this.logCliEvent(
        flags,
        "room",
        "subscribingToStatus",
        `Subscribing to status changes for room ${this.roomName}`,
      );
      room.onStatusChange((statusChange: unknown) => {
        const change = statusChange as StatusChange;
        this.logCliEvent(
          flags,
          "room",
          `status-${change.current}`,
          `Room status changed to ${change.current}`,
          { reason: change.reason, room: this.roomName },
        );
        if (change.current === "attached") {
          this.logCliEvent(
            flags,
            "room",
            "statusAttached",
            "Room status is ATTACHED.",
          );
          // Log the ready signal for E2E tests
          this.log(`Connected to room: ${this.roomName}`);
          if (!this.shouldOutputJson(flags)) {
            this.log(
              chalk.green(
                `✓ Subscribed to room: ${chalk.cyan(this.roomName)}. Listening for messages...`,
              ),
            );
          }
          // If we want to suppress output, we just don't log anything
        } else if (change.current === "failed") {
          const errorMsg = room.error?.message || "Unknown error";
          if (this.shouldOutputJson(flags)) {
            // Logged via logCliEvent
          } else {
            this.error(`Failed to attach to room: ${errorMsg}`);
          }
        }
      });
      this.logCliEvent(
        flags,
        "room",
        "subscribedToStatus",
        `Successfully subscribed to status changes for room ${this.roomName}`,
      );

      // Attach to the room
      this.logCliEvent(
        flags,
        "room",
        "attaching",
        `Attaching to room ${this.roomName}`,
      );
      await room.attach();
      this.logCliEvent(
        flags,
        "room",
        "attachCallComplete",
        `room.attach() call complete for ${this.roomName}. Waiting for status change to 'attached'.`,
      );
      // Note: successful attach logged by onStatusChange handler

      this.logCliEvent(
        flags,
        "subscribe",
        "listening",
        "Now listening for messages and status changes",
      );

      // Wait until the user interrupts or the optional duration elapses
      const effectiveDuration =
        typeof flags.duration === "number" && flags.duration > 0
          ? flags.duration
          : process.env.ABLY_CLI_DEFAULT_DURATION
            ? Number(process.env.ABLY_CLI_DEFAULT_DURATION)
            : undefined;

      const exitReason = await waitUntilInterruptedOrTimeout(effectiveDuration);
      this.logCliEvent(flags, "subscribe", "runComplete", "Exiting wait loop", {
        exitReason,
      });
      this.cleanupInProgress = exitReason === "signal"; // mark if signal so finally knows
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logCliEvent(
        flags,
        "subscribe",
        "fatalError",
        `Failed to subscribe to messages: ${errorMsg}`,
        { error: errorMsg, room: this.roomName },
      );

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            { error: errorMsg, room: this.roomName, success: false },
            flags,
          ),
        );
      } else {
        this.error(`Failed to subscribe to messages: ${errorMsg}`);
      }
    }
  }
}
