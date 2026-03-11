import { BaseTopicCommand } from "../../../base-topic-command.js";

export default class ReactionsIndex extends BaseTopicCommand {
  protected topicName = "rooms:reactions";
  protected commandGroup = "Room reaction";

  static override description =
    "Commands for working with reactions in chat rooms";

  static override examples = [
    "<%= config.bin %> <%= command.id %> send my-room like",
    "<%= config.bin %> <%= command.id %> subscribe my-room",
  ];
}
