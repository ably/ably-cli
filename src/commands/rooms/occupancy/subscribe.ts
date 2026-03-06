import { OccupancyEvent, ChatClient } from "@ably/chat";
import { Args } from "@oclif/core";
import chalk from "chalk";

import { ChatBaseCommand } from "../../../chat-base-command.js";
import { clientIdFlag, durationFlag, productApiFlags } from "../../../flags.js";
import { waitUntilInterruptedOrTimeout } from "../../../utils/long-running.js";
import { progress, resource, formatTimestamp } from "../../../utils/output.js";

export interface OccupancyMetrics {
  connections?: number;
  presenceMembers?: number;
}

export default class RoomsOccupancySubscribe extends ChatBaseCommand {
  static override args = {
    room: Args.string({
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
    this.roomName = args.room; // Store for cleanup

    try {
      this.logCliEvent(
        flags,
        "subscribe",
        "connecting",
        "Connecting to Ably...",
      );
      if (!this.shouldOutputJson(flags)) {
        this.log(progress("Connecting to Ably"));
      }

      // Create Chat client
      this.chatClient = await this.createChatClient(flags);

      if (!this.chatClient) {
        this.error("Failed to create Chat client");
        return;
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
      this.setupRoomStatusHandler(room, flags, {
        roomName: this.roomName!,
        successMessage: `Subscribed to occupancy in room: ${resource(this.roomName!)}.`,
        listeningMessage: "Listening for occupancy updates.",
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

      // Get the initial occupancy metrics
      this.logCliEvent(
        flags,
        "occupancy",
        "gettingInitial",
        "Fetching initial occupancy metrics",
      );
      try {
        const initialOccupancy = await room.occupancy.get();
        this.logCliEvent(
          flags,
          "occupancy",
          "gotInitial",
          "Initial occupancy metrics fetched",
          { metrics: initialOccupancy },
        );
        this.displayOccupancyMetrics(
          initialOccupancy,
          this.roomName,
          flags,
          true,
        );
      } catch (error) {
        const errorMsg = `Failed to fetch initial occupancy: ${error instanceof Error ? error.message : String(error)}`;
        this.logCliEvent(flags, "occupancy", "getInitialError", errorMsg, {
          error: errorMsg,
        });
        if (!this.shouldOutputJson(flags)) {
          this.log(chalk.yellow(errorMsg));
        }
      }

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

      // Wait until the user interrupts or the optional duration elapses
      await waitUntilInterruptedOrTimeout(flags.duration);
    } catch (error) {
      this.handleCommandError(error, flags, "occupancy", {
        room: this.roomName,
      });
    }
  }

  private displayOccupancyMetrics(
    occupancyMetrics: OccupancyMetrics | OccupancyEvent,
    roomName: string | null,
    flags: Record<string, unknown>,
    isInitial = false,
  ): void {
    if (!roomName) return; // Guard against null roomName
    if (!occupancyMetrics) return; // Guard against undefined occupancyMetrics

    const timestamp = new Date().toISOString();
    const logData = {
      metrics: occupancyMetrics,
      room: roomName,
      timestamp,
      type: isInitial ? "initialSnapshot" : "update",
    };
    this.logCliEvent(
      flags,
      "occupancy",
      isInitial ? "initialMetrics" : "updateReceived",
      isInitial ? "Initial occupancy metrics" : "Occupancy update received",
      logData,
    );

    if (this.shouldOutputJson(flags)) {
      this.log(this.formatJsonOutput({ success: true, ...logData }, flags));
    } else {
      const prefix = isInitial ? "Initial occupancy" : "Occupancy update";
      this.log(
        `${formatTimestamp(timestamp)} ${prefix} for room ${resource(roomName)}`,
      );
      // Type guard to handle both OccupancyMetrics and OccupancyEvent
      const connections =
        "connections" in occupancyMetrics ? occupancyMetrics.connections : 0;
      const presenceMembers =
        "presenceMembers" in occupancyMetrics
          ? occupancyMetrics.presenceMembers
          : undefined;

      this.log(`  Connections: ${connections ?? 0}`);

      if (presenceMembers !== undefined) {
        this.log(`  Presence Members: ${presenceMembers}`);
      }

      this.log(""); // Empty line for better readability
    }
  }
}
