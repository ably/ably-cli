import { ChatClient, PresenceData, Room } from "@ably/chat";
import { Args, Flags } from "@oclif/core";

import { ChatBaseCommand } from "../../../chat-base-command.js";
import { clientIdFlag, durationFlag, productApiFlags } from "../../../flags.js";
import {
  formatClientId,
  formatLabel,
  formatListening,
  formatProgress,
  formatResource,
  formatSuccess,
  formatWarning,
} from "../../../utils/output.js";

export default class RoomsPresenceUpdate extends ChatBaseCommand {
  static override args = {
    room: Args.string({
      description: "Room to update presence in",
      required: true,
    }),
  };

  static override description = "Update presence data in a chat room";

  static override examples = [
    `$ ably rooms presence update my-room --data '{"status":"away"}'`,
    `$ ably rooms presence update my-room --data '{"status":"busy"}' --json`,
    `$ ably rooms presence update my-room --data '{"status":"busy"}' --pretty-json`,
    `$ ably rooms presence update my-room --data '{"status":"online"}' --duration 60`,
  ];

  static override flags = {
    ...productApiFlags,
    "client-id": Flags.string({
      description: "ClientId of a rooms presence member.",
      required: true,
    }),
    data: Flags.string({
      description: "JSON data to associate with the presence update",
    }),
    ...durationFlag,
  };

  private chatClient: ChatClient | null = null;
  private room: Room | null = null;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(RoomsPresenceUpdate);

    try {
      this.chatClient = await this.createChatClient(flags);

      if (!this.chatClient) {
        return this.fail(
          "Failed to create Chat client",
          flags,
          "roomPresenceUpdate",
        );
      }

      const { room: roomName } = args;
      const data = this.parseJsonFlag(
        flags.data ?? "{}",
        "data",
        flags,
      ) as PresenceData;

      const wildcardWarning = `Updating a clientId on behalf of another user using a wildcard (*) is not supported, since chat rooms only recognize explicitly identified clients. So, a member with provided clientId but a new connectionId will be entered and updated.`;

      if (this.shouldOutputJson(flags)) {
        this.logJsonStatus("warning", wildcardWarning, flags);
      } else {
        this.log(formatWarning(wildcardWarning));
      }

      this.setupConnectionStateLogging(this.chatClient.realtime, flags, {
        includeUserFriendlyMessages: true,
      });

      this.room = await this.chatClient.rooms.get(roomName);

      this.setupRoomStatusHandler(this.room, flags, {
        roomName,
        successMessage: `Connected to room: ${formatResource(roomName)}.`,
      });

      await this.room.attach();

      if (!this.shouldOutputJson(flags)) {
        this.log(
          formatProgress(
            `Entering and updating presence in room: ${formatResource(roomName)}`,
          ),
        );
      }

      this.logCliEvent(
        flags,
        "presence",
        "entering",
        `Entering presence in room ${roomName}`,
        { room: roomName, clientId: this.chatClient.clientId },
      );
      await this.room.presence.enter();
      this.logCliEvent(
        flags,
        "presence",
        "entered",
        `Entered presence in room ${roomName}`,
        { room: roomName, clientId: this.chatClient.clientId },
      );

      this.logCliEvent(
        flags,
        "presence",
        "updating",
        `Updating presence data in room ${roomName}`,
        { room: roomName, data },
      );
      await this.room.presence.update(data);
      this.logCliEvent(
        flags,
        "presence",
        "updated",
        `Updated presence data in room ${roomName}`,
        { room: roomName, clientId: this.chatClient.clientId, data },
      );

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            presenceMessage: {
              action: "update",
              room: roomName,
              clientId: this.chatClient.clientId,
              connectionId: this.chatClient.realtime.connection.id,
              data,
              timestamp: new Date().toISOString(),
            },
          },
          flags,
        );
      } else {
        this.log(
          formatSuccess(
            `Updated presence in room: ${formatResource(roomName)}.`,
          ),
        );
        this.log(
          `${formatLabel("Client ID")} ${formatClientId(this.chatClient.clientId ?? "unknown")}`,
        );
        this.log(
          `${formatLabel("Connection ID")} ${this.chatClient.realtime.connection.id}`,
        );
        this.log(`${formatLabel("Data")} ${JSON.stringify(data)}`);
        this.log(formatListening("Holding presence."));
      }

      this.logJsonStatus(
        "holding",
        "Holding presence. Press Ctrl+C to exit.",
        flags,
      );

      await this.waitAndTrackCleanup(flags, "presence", flags.duration);
    } catch (error) {
      this.fail(error, flags, "roomPresenceUpdate", {
        room: args.room,
      });
    }
  }
}
