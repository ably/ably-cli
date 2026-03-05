import { Args } from "@oclif/core";
import { ChatClient, Room, OccupancyData } from "@ably/chat";
import { ChatBaseCommand } from "../../../chat-base-command.js";
import { productApiFlags } from "../../../flags.js";
import { resource } from "../../../utils/output.js";

export default class RoomsOccupancyGet extends ChatBaseCommand {
  static override args = {
    room: Args.string({
      description: "Room to get occupancy for",
      required: true,
    }),
  };

  static override description = "Get current occupancy metrics for a room";

  static override examples = [
    "$ ably rooms occupancy get my-room",
    '$ ABLY_API_KEY="YOUR_API_KEY" ably rooms occupancy get my-room',
    "$ ably rooms occupancy get my-room --json",
    "$ ably rooms occupancy get my-room --pretty-json",
  ];

  static override flags = {
    ...productApiFlags,
  };

  private chatClient: ChatClient | null = null;
  private room: Room | null = null;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(RoomsOccupancyGet);

    try {
      // Create Chat client
      this.chatClient = await this.createChatClient(flags);

      if (!this.chatClient) {
        this.error("Failed to create Chat client");
        return;
      }

      const { room: roomName } = args;

      // Get the room with occupancy enabled
      this.room = await this.chatClient.rooms.get(roomName);

      // Attach to the room to access occupancy with timeout
      let attachTimeout;
      await Promise.race([
        this.room.attach(),
        new Promise((_, reject) => {
          attachTimeout = setTimeout(
            () => reject(new Error("Room attach timeout")),
            10000,
          );
        }),
      ]);

      clearTimeout(attachTimeout);

      // Get occupancy metrics using the Chat SDK's occupancy API
      let occupancyTimeout;
      const occupancyMetrics = await Promise.race([
        this.room.occupancy.get(),
        new Promise<OccupancyData>((_, reject) => {
          occupancyTimeout = setTimeout(
            () => reject(new Error("Occupancy get timeout")),
            5000,
          );
        }),
      ]);
      clearTimeout(occupancyTimeout);

      // Output the occupancy metrics based on format
      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              metrics: occupancyMetrics,
              room: roomName,
              success: true,
            },
            flags,
          ),
        );
      } else {
        this.log(`Occupancy metrics for room ${resource(roomName)}:\n`);
        this.log(`Connections: ${occupancyMetrics.connections ?? 0}`);

        this.log(`Presence Members: ${occupancyMetrics.presenceMembers ?? 0}`);
      }
    } catch (error) {
      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          {
            error: error instanceof Error ? error.message : String(error),
            room: args.room,
            success: false,
          },
          flags,
        );
      } else {
        this.error(
          `Error fetching room occupancy: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}
