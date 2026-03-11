import { BaseTopicCommand } from "../../../../base-topic-command.js";

export default class MessagesReactionsIndex extends BaseTopicCommand {
  protected topicName = "rooms:messages:reactions";
  protected commandGroup = "Message reaction";

  static override description =
    "Commands for working with message reactions in chat rooms";

  static override examples = [
    '<%= config.bin %> <%= command.id %> send my-room "message-id" "\uD83D\uDC4D"',
    "<%= config.bin %> <%= command.id %> subscribe my-room",
  ];
}
