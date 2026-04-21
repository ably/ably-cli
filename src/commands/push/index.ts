import { BaseTopicCommand } from "../../base-topic-command.js";

export default class Push extends BaseTopicCommand {
  protected topicName = "push";
  protected commandGroup = "Push notification";

  static override description = "Manage push notifications";

  static override examples = [
    "<%= config.bin %> <%= command.id %> publish --device-id device1 --title Hello --body World",
    "<%= config.bin %> <%= command.id %> devices list",
    '<%= config.bin %> <%= command.id %> channels list "my-channel"',
    "<%= config.bin %> <%= command.id %> config show",
  ];
}
