import { BaseTopicCommand } from "../../../base-topic-command.js";

export default class PushChannels extends BaseTopicCommand {
  protected topicName = "push:channels";
  protected commandGroup = "Push channel subscription";

  static override description =
    "Manage push notification channel subscriptions";

  static override examples = [
    '<%= config.bin %> <%= command.id %> list "my-channel"',
    '<%= config.bin %> <%= command.id %> save "my-channel" --device-id device-123',
    "<%= config.bin %> <%= command.id %> list-channels",
  ];
}
