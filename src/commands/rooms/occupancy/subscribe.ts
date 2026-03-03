import {
  OccupancyEvent,
  RoomStatus,
  RoomStatusChange,
  ChatClient,
} from "@ably/chat";
import { Args, Flags } from "@oclif/core";
import chalk from "chalk";

import { ChatBaseCommand } from "../../../chat-base-command.js";
import { waitUntilInterruptedOrTimeout } from "../../../utils/long-running.js";

export interface OccupancyMetrics {
  connections?: number;
  presenceMembers?: number;
}

export default class RoomsOccupancySubscribe extends ChatBaseCommand {
  static args = {
    room: Args.string({
      description: "Room to subscribe to occupancy for",
      required: true,
    }),
  };

  static description = "Subscribe to real-time occupancy metrics for a room";

  static examples = [
    "$ ably rooms occupancy subscribe my-room",
    "$ ably rooms occupancy subscribe my-room --json",
    "$ ably rooms occupancy subscribe --pretty-json my-room",
  ];

  static flags = {
    ...ChatBaseCommand.globalFlags,
    duration: Flags.integer({
      description:
        "Automatically exit after the given number of seconds (0 = run indefinitely)",
      char: "D",
      required: false,
    }),
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
        this.log("Connecting to Ably...");
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
      this.logCliEvent(
        flags,
        "room",
        "subscribingToStatus",
        "Subscribing to room status changes",
      );
      room.onStatusChange((statusChange: RoomStatusChange) => {
        let reason: Error | null | string | undefined;
        if (statusChange.current === RoomStatus.Failed) {
          reason = room.error; // Get reason from room.error on failure
        }

        const reasonMsg = reason instanceof Error ? reason.message : reason;
        this.logCliEvent(
          flags,
          "room",
          `status-${statusChange.current}`,
          `Room status changed to ${statusChange.current}`,
          { reason: reasonMsg },
        );

        switch (statusChange.current) {
          case RoomStatus.Attached: {
            if (!this.shouldOutputJson(flags)) {
              this.log("Successfully connected to Ably");
              this.log(
                `Subscribing to occupancy events for room '${this.roomName}'...`,
              );
            }

            break;
          }

          case RoomStatus.Detached: {
            if (!this.shouldOutputJson(flags)) {
              this.log("Disconnected from Ably");
            }

            break;
          }

          case RoomStatus.Failed: {
            if (!this.shouldOutputJson(flags)) {
              this.error(`Connection failed: ${reasonMsg || "Unknown error"}`);
            }

            break;
          }
          // No default
        }
      });
      this.logCliEvent(
        flags,
        "room",
        "subscribedToStatus",
        "Successfully subscribed to room status changes",
      );

      // Attach to the room
      this.logCliEvent(
        flags,
        "room",
        "attaching",
        `Attaching to room ${this.roomName}`,
      );
      await room.attach();
      // Successful attach logged by onStatusChange handler

      this.logCliEvent(
        flags,
        "occupancy",
        "listening",
        "Listening for occupancy updates...",
      );
      if (!this.shouldOutputJson(flags)) {
        this.log("Listening for occupancy updates. Press Ctrl+C to exit.");
      }

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
        "Successfully subscribed to occupancy updates",
      );

      // Wait until the user interrupts or the optional duration elapses
      await waitUntilInterruptedOrTimeout(flags.duration);
    } catch (error) {
      const errorMsg = `Error: ${error instanceof Error ? error.message : String(error)}`;
      this.logCliEvent(flags, "occupancy", "fatalError", errorMsg, {
        error: errorMsg,
        room: this.roomName,
      });
      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          { error: errorMsg, room: this.roomName, success: false },
          flags,
        );
      } else {
        this.error(errorMsg);
      }
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
      this.log(`[${timestamp}] ${prefix} for room '${roomName}'`);
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
