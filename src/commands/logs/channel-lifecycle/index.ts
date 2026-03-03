import { BaseTopicCommand } from "../../../base-topic-command.js";

export default class LogsChannelLifecycleIndexCommand extends BaseTopicCommand {
  protected topicName = "logs:channel-lifecycle";
  protected commandGroup = "logging";

  static override description =
    "Stream logs from [meta]channel.lifecycle meta channel";

  static override examples = [
    "ably logs channel-lifecycle subscribe",
    "ably logs channel-lifecycle subscribe --rewind 10",
  ];
}
