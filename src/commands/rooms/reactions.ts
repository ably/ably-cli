import { BaseTopicCommand } from "../../base-topic-command.js";

export default class RoomsReactions extends BaseTopicCommand {
  protected topicName = "rooms:reactions";
  protected commandGroup = "Room reaction";

  static override description = "Manage reactions in Ably chat rooms";

  static override examples = [
    "<%= config.bin %> <%= command.id %> send my-room thumbs_up",
    "<%= config.bin %> <%= command.id %> subscribe my-room",
  ];
}
