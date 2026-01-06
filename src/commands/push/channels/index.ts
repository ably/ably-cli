import { BaseTopicCommand } from "../../../base-topic-command.js";

export default class PushChannels extends BaseTopicCommand {
  protected topicName = "push:channels";
  protected commandGroup = "push channel subscription";

  static override description =
    "Manage push notification channel subscriptions (maps to push.admin.channelSubscriptions)";

  static override examples = [
    "<%= config.bin %> <%= command.id %> save --channel alerts --device-id my-device",
    "<%= config.bin %> <%= command.id %> list --channel alerts",
    "<%= config.bin %> <%= command.id %> list-channels",
    "<%= config.bin %> <%= command.id %> remove --channel alerts --device-id my-device",
  ];
}
