import { BaseTopicCommand } from "../../../base-topic-command.js";

export default class TypingIndex extends BaseTopicCommand {
  protected topicName = "rooms:typing";
  protected commandGroup = "Room typing";

  static override description =
    "Commands for working with typing indicators in chat rooms";

  static override examples = [
    "<%= config.bin %> <%= command.id %> subscribe my-room",
    "<%= config.bin %> <%= command.id %> keystroke my-room",
  ];
}
