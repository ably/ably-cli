import { BaseTopicCommand } from "../../../base-topic-command.js";

export default class SpacesCursorsIndex extends BaseTopicCommand {
  protected topicName = "spaces:cursors";
  protected commandGroup = "Spaces cursor";

  static override description = "Commands for cursor management in Ably Spaces";

  static override examples = [
    "<%= config.bin %> <%= command.id %> set my-space --x 100 --y 200",
    "<%= config.bin %> <%= command.id %> subscribe my-space",
    "<%= config.bin %> <%= command.id %> get-all my-space",
  ];
}
