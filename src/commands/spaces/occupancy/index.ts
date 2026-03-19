import { BaseTopicCommand } from "../../../base-topic-command.js";

export default class SpacesOccupancyIndex extends BaseTopicCommand {
  protected topicName = "spaces:occupancy";
  protected commandGroup = "Spaces occupancy";

  static override description =
    "Commands for working with occupancy in Ably Spaces";

  static override examples = [
    "<%= config.bin %> <%= command.id %> get my-space",
    "<%= config.bin %> <%= command.id %> subscribe my-space",
  ];
}
