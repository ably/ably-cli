import { ChatClient, Room, PresenceEvent } from "@ably/chat";
import { Args } from "@oclif/core";

import { productApiFlags, clientIdFlag, durationFlag } from "../../../flags.js";
import { ChatBaseCommand } from "../../../chat-base-command.js";
import { isJsonData } from "../../../utils/json-formatter.js";
import {
  formatClientId,
  formatEventType,
  formatLabel,
  formatMessageTimestamp,
  formatResource,
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
      // Show a progress signal early so E2E harnesses know the command is running
      this.logProgress(
        `Subscribing to presence in room: ${formatResource(this.roomName)}`,
        flags,
      );

      // Try to create clients, but don't fail if auth fails
      try {
        this.chatClient = await this.createChatClient(flags);
      } catch (authError) {
        // Auth failed, but we still want to show the signal and wait
        this.logCliEvent(
          flags,
          "initialization",
          "authFailed",
          `Authentication failed: ${authError instanceof Error ? authError.message : String(authError)}`,
        );
        this.logWarning(
          "Failed to connect to Ably (authentication failed).",
          flags,
        );

        // Wait for the duration even with auth failures
        await this.waitAndTrackCleanup(flags, "presence", flags.duration);
        return;
      }

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

      const { failurePromise } = this.setupRoomStatusHandler(
        currentRoom,
        flags,
        {
          roomName: this.roomName,
          listeningMessage: undefined,
        },
      );

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

      this.logSuccessMessage(
        `Subscribed to presence in room: ${formatResource(this.roomName)}.`,
        flags,
      );
      this.logListening("Listening for presence events.", flags);

      // Wait until the user interrupts or the optional duration elapses
      await Promise.race([
        this.waitAndTrackCleanup(flags, "presence", flags.duration),
        failurePromise,
      ]);
    } catch (error) {
      this.fail(error, flags, "roomPresenceSubscribe", {
        room: this.roomName,
      });
    }
  }
}
