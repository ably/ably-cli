import { Args, Flags } from "@oclif/core";
import { ChatMessageEvent, ChatClient } from "@ably/chat"; // Import ChatClient and StatusSubscription
import chalk from "chalk";

import { productApiFlags, clientIdFlag, durationFlag } from "../../../flags.js";
import { ChatBaseCommand } from "../../../chat-base-command.js";
import {
  formatLabel,
  formatProgress,
  formatResource,
  formatTimestamp,
  formatMessageTimestamp,
  formatIndex,
  formatEventType,
  formatClientId,
} from "../../../utils/output.js";

// Define message interface
interface ChatMessage {
  clientId: string;
  text: string;
  timestamp: number | Date; // Support both timestamp types
  serial: string;
  action: string;
  metadata?: Record<string, unknown>;
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
    '$ ABLY_API_KEY="YOUR_API_KEY" ably rooms messages subscribe my-room',
    "$ ably rooms messages subscribe --show-metadata my-room",
    "$ ably rooms messages subscribe my-room --duration 30",
    "$ ably rooms messages subscribe my-room --json",
    "$ ably rooms messages subscribe my-room --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    "show-metadata": Flags.boolean({
      default: false,
      description: "Display message metadata if available",
    }),
    ...durationFlag,
    "sequence-numbers": Flags.boolean({
      default: false,
      description: "Include sequence numbers in output",
    }),
  };

  static override strict = false;

  private chatClient: ChatClient | null = null;
  private roomNames: string[] = [];
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
        serial: message.serial,
        action: String(messageEvent.type),
        ...(message.metadata ? { metadata: message.metadata } : {}),
      };
      this.logCliEvent(flags, "message", "received", "Message received", {
        message: messageLog,
        room: roomName,
      });

      if (this.shouldOutputJson(flags)) {
        this.logJsonEvent(
          {
            eventType: messageEvent.type,
            message: messageLog,
            room: roomName,
            ...(flags["sequence-numbers"]
              ? { sequence: this.sequenceCounter }
              : {}),
          },
          flags,
        );
      } else {
        // Format message with timestamp, author and content
        const timestamp = formatMessageTimestamp(message.timestamp);
        const author = message.clientId || "Unknown";

        // Prefix with room name when multiple rooms
        const roomPrefix =
          this.roomNames.length > 1 ? `${chalk.magenta(`[${roomName}]`)} ` : "";

        const sequencePrefix = flags["sequence-numbers"]
          ? `${formatIndex(this.sequenceCounter)}`
          : "";

        // Message content with multi-line labeled block
        this.log(`${roomPrefix}${formatTimestamp(timestamp)}${sequencePrefix}`);
        this.log(
          `${roomPrefix}  ${formatLabel("Action")} ${formatEventType(String(messageEvent.type))}`,
        );
        this.log(
          `${roomPrefix}  ${formatLabel("Client ID")} ${formatClientId(author)}`,
        );
        this.log(`${roomPrefix}  ${formatLabel("Text")} ${message.text}`);
        this.log(
          `${roomPrefix}  ${formatLabel("Serial")} ${formatResource(message.serial)}`,
        );

        // Show metadata if enabled and available
        if (flags["show-metadata"] && message.metadata) {
          this.log(
            `${roomPrefix}  ${formatLabel("Metadata")} ${chalk.yellow(this.formatJsonOutput(message.metadata, flags))}`,
          );
        }

        this.log(""); // Empty line for better readability
      }
    });
    this.logCliEvent(
      flags,
      "room",
      "subscribedToMessages",
      `Subscribed to messages in room ${roomName}`,
    );

    this.setupRoomStatusHandler(room, flags, {
      roomName,
      successMessage: `Subscribed to room: ${formatResource(roomName)}.`,
      listeningMessage: "Listening for messages.",
    });

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
    const parseResult = await this.parse(MessagesSubscribe);
    const { flags } = parseResult;

    // Get all room names from argv
    this.roomNames = parseResult.argv as string[];

    if (this.roomNames.length === 0) {
      this.fail(
        new Error("At least one room name is required"),
        flags,
        "roomMessageSubscribe",
      );
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
          ? this.roomNames.map((r) => formatResource(r)).join(", ")
          : formatResource(this.roomNames[0]);

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Attaching to room${this.roomNames.length > 1 ? "s" : ""}: ${roomList}`,
          ),
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
      await this.waitAndTrackCleanup(flags, "subscribe", flags.duration);
    } catch (error) {
      this.fail(error, flags, "roomMessageSubscribe", {
        rooms: this.roomNames,
      });
    }
  }
}
