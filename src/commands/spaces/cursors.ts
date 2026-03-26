import { BaseTopicCommand } from "../../base-topic-command.js";

export default class SpacesCursors extends BaseTopicCommand {
  protected topicName = "spaces:cursors";
  protected commandGroup = "Spaces cursor";

  static override description =
    "Commands for interacting with Cursors in Ably Spaces";

  static override examples = [
    "<%= config.bin %> <%= command.id %> set my-space --x 100 --y 200",
    "<%= config.bin %> <%= command.id %> subscribe my-space",
    "<%= config.bin %> <%= command.id %> get my-space",
  ];
}
