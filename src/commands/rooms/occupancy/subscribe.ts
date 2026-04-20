import { OccupancyEvent, ChatClient } from "@ably/chat";
import { Args } from "@oclif/core";

import { ChatBaseCommand } from "../../../chat-base-command.js";
import { clientIdFlag, durationFlag, productApiFlags } from "../../../flags.js";
import {
  formatLabel,
  formatResource,
  formatTimestamp,
} from "../../../utils/output.js";

export interface OccupancyMetrics {
  connections?: number;
  presenceMembers?: number;
}

export default class RoomsOccupancySubscribe extends ChatBaseCommand {
  static override args = {
    roomName: Args.string({
      description: "Room to subscribe to occupancy for",
      required: true,
    }),
  };

  static override description =
    "Subscribe to real-time occupancy metrics for a room";

  static override examples = [
    "$ ably rooms occupancy subscribe my-room",
    "$ ably rooms occupancy subscribe my-room --json",
    "$ ably rooms occupancy subscribe --pretty-json my-room",
  ];

  static override flags = {
    ...productApiFlags,
    ...clientIdFlag,
    ...durationFlag,
  };

  private chatClient: ChatClient | null = null;
  private roomName: string | null = null;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(RoomsOccupancySubscribe);
    this.roomName = args.roomName; // Store for cleanup

    try {
      this.logCliEvent(
        flags,
        "subscribe",
        "connecting",
        "Connecting to Ably...",
      );
      this.logProgress("Connecting to Ably", flags);

      // Create Chat client
      this.chatClient = await this.createChatClient(flags);

      if (!this.chatClient) {
        return this.fail(
          "Failed to create Chat client",
          flags,
          "roomOccupancySubscribe",
        );
      }

      // Set up connection state logging
      this.setupConnectionStateLogging(this.chatClient.realtime, flags, {
        includeUserFriendlyMessages: true,
      });

      // Get the room with occupancy option enabled
      this.logCliEvent(
        flags,
        "room",
        "gettingRoom",
        `Getting room handle for ${this.roomName}`,
      );

      const room = await this.chatClient.rooms.get(this.roomName, {
        occupancy: { enableEvents: true },
      });

      this.logCliEvent(
        flags,
        "room",
        "gotRoom",
        `Got room handle for ${this.roomName}`,
      );

      // Subscribe to room status changes
      const { failurePromise } = this.setupRoomStatusHandler(room, flags, {
        roomName: this.roomName,
      });

      // Attach to the room
      this.logCliEvent(
        flags,
        "room",
        "attaching",
        `Attaching to room ${this.roomName}`,
      );
      await room.attach();
      // Successful attach logged by onStatusChange handler

      // Subscribe to occupancy events
      this.logCliEvent(
        flags,
        "occupancy",
        "subscribing",
        "Subscribing to occupancy updates",
      );

      room.occupancy.subscribe((occupancyEvent: OccupancyEvent) => {
        const occupancyMetrics = occupancyEvent.occupancy;
        this.logCliEvent(
          flags,
          "occupancy",
          "updateReceived",
          "Occupancy update received",
          { metrics: occupancyMetrics },
        );
        this.displayOccupancyMetrics(occupancyMetrics, this.roomName, flags);
      });

      this.logCliEvent(
        flags,
        "occupancy",
        "subscribed",
        "Subscribed to occupancy updates",
      );

      this.logSuccessMessage(
        `Subscribed to occupancy in room: ${formatResource(this.roomName)}.`,
        flags,
      );
      this.logListening("Listening for occupancy updates.", flags);

      // Wait until the user interrupts or the optional duration elapses
      await Promise.race([
        this.waitAndTrackCleanup(flags, "occupancy", flags.duration),
        failurePromise,
      ]);
    } catch (error) {
      this.fail(error, flags, "roomOccupancySubscribe", {
        room: this.roomName,
      });
    }
  }

  private displayOccupancyMetrics(
    occupancyMetrics: OccupancyMetrics | undefined,
    roomName: string | null,
    flags: Record<string, unknown>,
  ): void {
    if (!roomName) return; // Guard against null roomName
    if (!occupancyMetrics) return; // Guard against undefined occupancyMetrics

    const timestamp = new Date().toISOString();
    const logData = {
      metrics: occupancyMetrics,
      room: roomName,
      timestamp,
      eventType: "update",
    };

    if (this.shouldOutputJson(flags)) {
      this.logJsonEvent({ occupancy: logData }, flags);
    } else {
      this.log(`${formatTimestamp(timestamp)}`);
      // Type guard to handle both OccupancyMetrics and OccupancyEvent
      const connections = occupancyMetrics.connections ?? 0;
      const presenceMembers = occupancyMetrics.presenceMembers ?? 0;

      this.log(`${formatLabel("Connections")} ${connections}`);
      this.log(`${formatLabel("Presence Members")} ${presenceMembers}`);

      this.log(""); // Empty line for better readability
    }
  }
}
