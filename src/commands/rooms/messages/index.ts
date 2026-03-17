import { BaseTopicCommand } from "../../../base-topic-command.js";

export default class MessagesIndex extends BaseTopicCommand {
  protected topicName = "rooms:messages";
  protected commandGroup = "Room message";

  static override description =
    "Commands for working with chat messages in rooms";

  static override examples = [
    '<%= config.bin %> <%= command.id %> send my-room "Hello world!"',
    "<%= config.bin %> <%= command.id %> subscribe my-room",
    "<%= config.bin %> <%= command.id %> history my-room",
    '<%= config.bin %> <%= command.id %> update my-room "serial" "Updated text"',
    '<%= config.bin %> <%= command.id %> delete my-room "serial"',
  ];
}
