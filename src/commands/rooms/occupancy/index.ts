import { BaseTopicCommand } from "../../../base-topic-command.js";

export default class OccupancyIndex extends BaseTopicCommand {
  protected topicName = "rooms:occupancy";
  protected commandGroup = "Room occupancy";

  static override description =
    "Commands for working with occupancy in chat rooms";

  static override examples = [
    "<%= config.bin %> <%= command.id %> get my-room",
    "<%= config.bin %> <%= command.id %> subscribe my-room",
  ];
}
