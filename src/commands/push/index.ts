import { BaseTopicCommand } from "../../base-topic-command.js";

export default class Push extends BaseTopicCommand {
  protected topicName = "push";
  protected commandGroup = "push notification";

  static override description =
    "Manage push notifications, device registrations, and channel subscriptions";

  static override examples = [
    "<%= config.bin %> <%= command.id %> devices list",
    "<%= config.bin %> <%= command.id %> devices save --id my-device --platform android --form-factor phone --transport-type fcm --device-token TOKEN",
    "<%= config.bin %> <%= command.id %> channels save --channel alerts --device-id my-device",
    '<%= config.bin %> <%= command.id %> publish --device-id my-device --title "Hello" --body "World"',
  ];
}
