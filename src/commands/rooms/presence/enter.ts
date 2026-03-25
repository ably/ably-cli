import { ChatClient, Room, PresenceEvent, PresenceData } from "@ably/chat";
import { Args, Flags } from "@oclif/core";
import { productApiFlags, clientIdFlag, durationFlag } from "../../../flags.js";
import { ChatBaseCommand } from "../../../chat-base-command.js";
import { isJsonData } from "../../../utils/json-formatter.js";
import {
  formatSuccess,
  formatListening,
  formatProgress,
  formatResource,
  formatTimestamp,
  formatEventType,
  formatIndex,
  formatClientId,
  formatLabel,
  formatMessageTimestamp,
} from "../../../utils/output.js";

export default class RoomsPresenceEnter extends ChatBaseCommand {
  static override args = {
    room: Args.string({
      description: "Room to enter presence on",
      required: true,
    }),
  };

  static override description =
    "Enter presence in a chat room and remain present until terminated.";

  static override examples = [
    "$ ably rooms presence enter my-room",
    `$ ably rooms presence enter my-room --data '{"name":"User","status":"active"}'`,
    "$ ably rooms presence enter my-room --show-others",
    "$ ably rooms presence enter my-room --duration 30",
    "$ ably rooms presence enter my-room --json",
    "$ ably rooms presence enter my-room --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,

    "show-others": Flags.boolean({
      default: false,
      description: "Show other presence events while present (default: false)",
    }),
    ...durationFlag,
    data: Flags.string({
      description: "Data to include with the member (JSON format)",
      required: false,
    }),
    "sequence-numbers": Flags.boolean({
      default: false,
      description: "Include sequence numbers in output",
    }),
  };

  private chatClient: ChatClient | null = null;
  private room: Room | null = null;
  private roomName: string | null = null;
  private data: PresenceData | null = null;

  private sequenceCounter = 0;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(RoomsPresenceEnter);
    this.roomName = args.room;

    if (flags.data) {
      const parsed = this.parseJsonFlag(flags.data, "data", flags);
      this.data = parsed as PresenceData;
    }

    try {
      // Create clients
      this.chatClient = await this.createChatClient(flags);

      if (!this.chatClient || !this.roomName) {
        this.fail(
          new Error("Failed to initialize chat client or room"),
          flags,
          "roomPresenceEnter",
        );
      }

      // Set up connection state logging
      this.setupConnectionStateLogging(this.chatClient.realtime, flags, {
        includeUserFriendlyMessages: true,
      });

      this.room = await this.chatClient.rooms.get(this.roomName);
      const currentRoom = this.room!;

      if (flags["show-others"]) {
        // Subscribe to room status changes only when showing others
        this.setupRoomStatusHandler(currentRoom, flags, {
          roomName: this.roomName,
          successMessage: `Connected to room: ${formatResource(this.roomName)}.`,
        });

        currentRoom.presence.subscribe((event: PresenceEvent) => {
          const member = event.member;
          if (member.clientId !== this.chatClient?.clientId) {
            this.sequenceCounter++;
            const timestamp = formatMessageTimestamp(
              member.updatedAt?.getTime(),
            );
            const presenceEvent = {
              action: event.type,
              room: this.roomName,
              clientId: member.clientId,
              connectionId: member.connectionId,
              data: member.data ?? null,
              timestamp,
              ...(flags["sequence-numbers"]
                ? { sequence: this.sequenceCounter }
                : {}),
            };
            this.logCliEvent(
              flags,
              "presence",
              event.type,
              `Presence event: ${event.type} by ${member.clientId}`,
              presenceEvent,
            );
            if (this.shouldOutputJson(flags)) {
              this.logJsonEvent({ presenceMessage: presenceEvent }, flags);
            } else {
              const sequencePrefix = flags["sequence-numbers"]
                ? `${formatIndex(this.sequenceCounter)}`
                : "";
              this.log(
                `${formatTimestamp(timestamp)}${sequencePrefix} ${formatResource(`Room: ${this.roomName!}`)} | Action: ${formatEventType(event.type)} | Client: ${formatClientId(member.clientId || "N/A")}`,
              );

              if (member.data !== null && member.data !== undefined) {
                if (isJsonData(member.data)) {
                  this.log(formatLabel("Data"));
                  this.log(JSON.stringify(member.data, null, 2));
                } else {
                  this.log(`${formatLabel("Data")} ${member.data}`);
                }
              }

              this.log(""); // Empty line for better readability
            }
          }
        });
      }

      await currentRoom.attach();

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Entering presence in room: ${formatResource(this.roomName)}`,
          ),
        );
      }

      this.logCliEvent(flags, "presence", "entering", "Entering presence", {
        room: this.roomName,
        clientId: this.chatClient!.clientId,
        data: this.data,
      });
      await currentRoom.presence.enter(this.data ?? undefined);
      this.logCliEvent(flags, "presence", "entered", "Entered presence", {
        room: this.roomName,
        clientId: this.chatClient!.clientId,
      });

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            presenceMessage: {
              action: "enter",
              room: this.roomName,
              clientId: this.chatClient!.clientId,
              connectionId: this.chatClient!.realtime.connection.id,
              data: this.data ?? null,
              timestamp: new Date().toISOString(),
            },
          },
          flags,
        );
      } else {
        this.log(
          formatSuccess(
            `Entered presence in room: ${formatResource(this.roomName!)}.`,
          ),
        );
        this.log(
          `${formatLabel("Client ID")} ${formatClientId(this.chatClient!.clientId ?? "unknown")}`,
        );
        this.log(
          `${formatLabel("Connection ID")} ${this.chatClient!.realtime.connection.id}`,
        );
        if (this.data !== undefined && this.data !== null) {
          this.log(`${formatLabel("Data")} ${JSON.stringify(this.data)}`);
        }
        this.log(
          formatListening(
            flags["show-others"]
              ? "Listening for presence events."
              : "Holding presence.",
          ),
        );
      }

      this.logJsonStatus(
        "holding",
        "Holding presence. Press Ctrl+C to exit.",
        flags,
      );

      // Wait until the user interrupts or the optional duration elapses
      await this.waitAndTrackCleanup(flags, "presence", flags.duration);
    } catch (error) {
      this.fail(error, flags, "roomPresenceEnter", {
        room: this.roomName,
      });
    }
  }
}
