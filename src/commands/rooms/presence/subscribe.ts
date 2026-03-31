import { ChatClient, Room, PresenceEvent } from "@ably/chat";
import { Args } from "@oclif/core";

import { productApiFlags, clientIdFlag, durationFlag } from "../../../flags.js";
import { ChatBaseCommand } from "../../../chat-base-command.js";
import { isJsonData } from "../../../utils/json-formatter.js";
import {
  formatClientId,
  formatEventType,
  formatLabel,
  formatListening,
  formatMessageTimestamp,
  formatProgress,
  formatResource,
  formatSuccess,
  formatTimestamp,
} from "../../../utils/output.js";

export default class RoomsPresenceSubscribe extends ChatBaseCommand {
  static override args = {
    room: Args.string({
      description: "Room to subscribe to presence for",
      required: true,
    }),
  };

  static override description = "Subscribe to presence events in a chat room";

  static override examples = [
    "$ ably rooms presence subscribe my-room",
    "$ ably rooms presence subscribe my-room --json",
    "$ ably rooms presence subscribe my-room --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    ...durationFlag,
  };

  private chatClient: ChatClient | null = null;
  private roomName: string | null = null;
  private room: Room | null = null;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(RoomsPresenceSubscribe);
    this.roomName = args.room;

    try {
      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Subscribing to presence events in room: ${formatResource(this.roomName)}`,
          ),
        );
      }

      this.chatClient = await this.createChatClient(flags);

      if (!this.chatClient) {
        this.fail(
          new Error("Failed to create Chat client"),
          flags,
          "roomPresenceSubscribe",
        );
      }

      // Set up connection state logging
      this.setupConnectionStateLogging(this.chatClient.realtime, flags, {
        includeUserFriendlyMessages: true,
      });

      this.room = await this.chatClient.rooms.get(this.roomName);
      const currentRoom = this.room;

      this.setupRoomStatusHandler(currentRoom, flags, {
        roomName: this.roomName,
        successMessage: `Connected to room: ${formatResource(this.roomName)}.`,
        listeningMessage: undefined,
      });

      await currentRoom.attach();

      // Subscribe to presence events
      this.logCliEvent(
        flags,
        "presence",
        "subscribing",
        `Subscribing to presence events in room: ${this.roomName}`,
        { room: this.roomName },
      );

      currentRoom.presence.subscribe((event: PresenceEvent) => {
        const member = event.member;
        const timestamp = formatMessageTimestamp(member.updatedAt.getTime());
        const presenceData = {
          action: event.type,
          room: this.roomName,
          clientId: member.clientId,
          connectionId: member.connectionId,
          data: (member.data as unknown) ?? null,
          timestamp,
        };
        this.logCliEvent(
          flags,
          "presence",
          event.type,
          `Presence event: ${event.type} by ${member.clientId}`,
          presenceData,
        );

        if (this.shouldOutputJson(flags)) {
          this.logJsonEvent({ presenceMessage: presenceData }, flags);
        } else {
          const lines: string[] = [
            formatTimestamp(timestamp),
            `${formatLabel("Timestamp")} ${timestamp}`,
            `${formatLabel("Action")} ${formatEventType(event.type)}`,
            `${formatLabel("Room")} ${formatResource(this.roomName!)}`,
          ];
          if (member.clientId) {
            lines.push(
              `${formatLabel("Client ID")} ${formatClientId(member.clientId)}`,
            );
          }
          if (member.connectionId) {
            lines.push(
              `${formatLabel("Connection ID")} ${member.connectionId}`,
            );
          }
          if (member.data !== null && member.data !== undefined) {
            if (isJsonData(member.data)) {
              lines.push(
                `${formatLabel("Data")}`,
                JSON.stringify(member.data, null, 2),
              );
            } else {
              lines.push(`${formatLabel("Data")} ${String(member.data)}`);
            }
          }
          this.log(lines.join("\n"));
          this.log(""); // Empty line for better readability
        }
      });

      this.logCliEvent(
        flags,
        "presence",
        "listening",
        "Listening for presence events. Press Ctrl+C to exit.",
      );

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatSuccess(
            `Subscribed to presence in room: ${formatResource(this.roomName)}.`,
          ),
        );
        this.log(formatListening("Listening for presence events."));
        this.log("");
      }

      // Wait until the user interrupts or the optional duration elapses
      await this.waitAndTrackCleanup(flags, "presence", flags.duration);
    } catch (error) {
      this.fail(error, flags, "roomPresenceSubscribe", {
        room: this.roomName,
      });
    }
  }
}
