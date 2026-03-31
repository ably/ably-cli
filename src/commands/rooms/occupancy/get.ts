import { Args } from "@oclif/core";
import { ChatClient, Room } from "@ably/chat";
import { ChatBaseCommand } from "../../../chat-base-command.js";
import { productApiFlags } from "../../../flags.js";
import { formatResource } from "../../../utils/output.js";

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
      this.chatClient = await this.createChatClient(flags, { restOnly: true });

      if (!this.chatClient) {
        return this.fail(
          "Failed to create Chat client",
          flags,
          "roomOccupancyGet",
        );
      }

      const { room: roomName } = args;

      this.room = await this.chatClient.rooms.get(roomName);

      const occupancyMetrics = await this.room.occupancy.get();

      // Output the occupancy metrics based on format
      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            occupancy: {
              metrics: occupancyMetrics,
              room: roomName,
            },
          },
          flags,
        );
      } else {
        this.log(`Occupancy metrics for room ${formatResource(roomName)}:\n`);
        this.log(`Connections: ${occupancyMetrics.connections ?? 0}`);

        this.log(`Presence Members: ${occupancyMetrics.presenceMembers ?? 0}`);
      }
    } catch (error) {
      this.fail(error, flags, "roomOccupancyGet", { room: args.room });
    }
  }
}
