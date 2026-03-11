import { BaseTopicCommand } from "../../base-topic-command.js";

export default class RoomsOccupancy extends BaseTopicCommand {
  protected topicName = "rooms:occupancy";
  protected commandGroup = "Room occupancy";

  static override description = "Commands for monitoring room occupancy";

  static override examples = [
    "<%= config.bin %> <%= command.id %> get my-room",
    "<%= config.bin %> <%= command.id %> subscribe my-room",
  ];
}
