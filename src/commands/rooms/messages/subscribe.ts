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
    rooms: Args.string({
      description: "Room name(s) to subscribe to messages from",
      multiple: false,
      required: true,
    }),
  };

  static override description =
    "Subscribe to messages in one or more Ably Chat rooms";

  static override examples = [
    "$ ably rooms messages subscribe my-room",
    "$ ably rooms messages subscribe room1 room2 room3",
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
    "sequence-numbers": Flags.boolean({
      default: false,
      description: "Include sequence numbers in output",
    }),
  };

  private chatClient: ChatClient | null = null;
  private roomNames: string[] = [];
  private cleanupInProgress: boolean = false;
  private sequenceCounter = 0;

  private async subscribeToRoom(
    roomName: string,
    flags: Record<string, unknown>,
  ): Promise<void> {
    // Get the room
    this.logCliEvent(
      flags,
      "room",
      "gettingRoom",
      `Getting room handle for ${roomName}`,
    );
    const room = await this.chatClient!.rooms.get(roomName, {});
    this.logCliEvent(
      flags,
      "room",
      "gotRoom",
      `Got room handle for ${roomName}`,
    );

    // Setup message handler
    this.logCliEvent(
      flags,
      "room",
      "subscribingToMessages",
      `Subscribing to messages in room ${roomName}`,
    );
    room.messages.subscribe((messageEvent: ChatMessageEvent) => {
      this.sequenceCounter++;
      const { message } = messageEvent;
      const messageLog: ChatMessage = {
        clientId: message.clientId,
        text: message.text,
        timestamp: message.timestamp,
        ...(message.metadata ? { metadata: message.metadata } : {}),
        ...(flags["sequence-numbers"]
          ? { sequence: this.sequenceCounter }
          : {}),
      };
      this.logCliEvent(flags, "message", "received", "Message received", {
        message: messageLog,
        room: roomName,
      });

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              message: messageLog,
              room: roomName,
              success: true,
              ...(flags["sequence-numbers"]
                ? { sequence: this.sequenceCounter }
                : {}),
            },
            flags,
          ),
        );
      } else {
        // Format message with timestamp, author and content
        const timestamp = new Date(message.timestamp).toISOString();
        const author = message.clientId || "Unknown";

        // Prefix with room name when multiple rooms
        const roomPrefix =
          this.roomNames.length > 1 ? `${chalk.magenta(`[${roomName}]`)} ` : "";

        const sequencePrefix = flags["sequence-numbers"]
          ? `${chalk.dim(`[${this.sequenceCounter}]`)}`
          : "";

        // Message content with consistent formatting
        this.log(
          `${roomPrefix}${chalk.gray(`[${timestamp}]`)}${sequencePrefix} ${chalk.cyan(`${author}:`)} ${message.text}`,
        );

        // Show metadata if enabled and available
        if (flags["show-metadata"] && message.metadata) {
          this.log(
            `${roomPrefix}${chalk.blue("  Metadata:")} ${chalk.yellow(this.formatJsonOutput(message.metadata, flags))}`,
          );
        }

        this.log(""); // Empty line for better readability
      }
    });
    this.logCliEvent(
      flags,
      "room",
      "subscribedToMessages",
      `Successfully subscribed to messages in room ${roomName}`,
    );

    // Subscribe to room status changes
    this.logCliEvent(
      flags,
      "room",
      "subscribingToStatus",
      `Subscribing to status changes for room ${roomName}`,
    );
    room.onStatusChange((statusChange: unknown) => {
      const change = statusChange as StatusChange;
      this.logCliEvent(
        flags,
        "room",
        `status-${change.current}`,
        `Room status changed to ${change.current}`,
        { reason: change.reason, room: roomName },
      );
      if (change.current === "attached") {
        this.logCliEvent(
          flags,
          "room",
          "statusAttached",
          `Room ${roomName} status is ATTACHED.`,
        );
        // Log the ready signal for E2E tests
        this.log(`Connected to room: ${roomName}`);
        if (!this.shouldOutputJson(flags)) {
          this.log(
            chalk.green(
              `✓ Subscribed to room: ${chalk.cyan(roomName)}. Listening for messages...`,
            ),
          );
        }
      } else if (change.current === "failed") {
        const errorMsg = room.error?.message || "Unknown error";
        if (this.shouldOutputJson(flags)) {
          // Logged via logCliEvent
        } else {
          this.error(`Failed to attach to room ${roomName}: ${errorMsg}`);
        }
      }
    });
    this.logCliEvent(
      flags,
      "room",
      "subscribedToStatus",
      `Successfully subscribed to status changes for room ${roomName}`,
    );

    // Attach to the room
    this.logCliEvent(
      flags,
      "room",
      "attaching",
      `Attaching to room ${roomName}`,
    );
    await room.attach();
    this.logCliEvent(
      flags,
      "room",
      "attachCallComplete",
      `room.attach() call complete for ${roomName}. Waiting for status change to 'attached'.`,
    );
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(MessagesSubscribe);
    const _args = await this.parse(MessagesSubscribe);

    // Get all room names from argv
    this.roomNames = _args.argv as string[];

    if (this.roomNames.length === 0) {
      const errorMsg = "At least one room name is required";
      this.logCliEvent(flags, "subscribe", "validationError", errorMsg, {
        error: errorMsg,
      });
      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput({ error: errorMsg, success: false }, flags),
        );
        process.exitCode = 1;
      } else {
        this.error(errorMsg);
      }
      return;
    }

    this.logCliEvent(
      flags,
      "subscribe.run",
      "start",
      `Starting rooms messages subscribe for rooms: ${this.roomNames.join(", ")}`,
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

      const roomList =
        this.roomNames.length > 1
          ? this.roomNames.map((r) => chalk.cyan(r)).join(", ")
          : chalk.cyan(this.roomNames[0]);

      if (!this.shouldOutputJson(flags)) {
        this.log(
          `Attaching to room${this.roomNames.length > 1 ? "s" : ""}: ${roomList}...`,
        );
      }

      if (!this.chatClient) {
        throw new Error("Failed to create Chat or Ably client");
      }

      // Set up connection state logging
      this.setupConnectionStateLogging(this.chatClient.realtime, flags, {
        includeUserFriendlyMessages: true,
      });

      // Subscribe to all rooms
      for (const roomName of this.roomNames) {
        await this.subscribeToRoom(roomName, flags);
      }

      this.logCliEvent(
        flags,
        "subscribe",
        "listening",
        "Now listening for messages and status changes",
      );

      // Wait until the user interrupts or the optional duration elapses
      const exitReason = await waitUntilInterruptedOrTimeout(flags.duration);
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
        { error: errorMsg, rooms: this.roomNames },
      );

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            { error: errorMsg, rooms: this.roomNames, success: false },
            flags,
          ),
        );
        process.exitCode = 1;
      } else {
        this.error(`Failed to subscribe to messages: ${errorMsg}`);
      }
    }
  }
}
