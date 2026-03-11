import { BaseTopicCommand } from "../../base-topic-command.js";

export default class RoomsPresence extends BaseTopicCommand {
  protected topicName = "rooms:presence";
  protected commandGroup = "Room presence";

  static override description = "Manage presence on Ably chat rooms";

  static override examples = [
    "<%= config.bin %> <%= command.id %> enter my-room",
    "<%= config.bin %> <%= command.id %> subscribe my-room",
  ];
}
