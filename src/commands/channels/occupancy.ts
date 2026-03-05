import { BaseTopicCommand } from "../../base-topic-command.js";

export default class ChannelsOccupancy extends BaseTopicCommand {
  protected topicName = "channels:occupancy";
  protected commandGroup = "channel occupancy";

  static override description = "Get occupancy metrics for a channel";

  static override examples = [
    "$ ably channels occupancy get my-channel",
    "$ ably channels occupancy subscribe my-channel",
  ];
}
