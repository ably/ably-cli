import { BaseTopicCommand } from "../../../base-topic-command.js";

export default class PresenceIndex extends BaseTopicCommand {
  protected topicName = "rooms:presence";
  protected commandGroup = "Room presence";

  static override description =
    "Commands for working with presence in chat rooms";

  static override examples = [
    "<%= config.bin %> <%= command.id %> enter my-room",
    "<%= config.bin %> <%= command.id %> subscribe my-room",
  ];
}
