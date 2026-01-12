import { BaseTopicCommand } from "../../../base-topic-command.js";

export default class LogsConnectionLifecycleIndexCommand extends BaseTopicCommand {
  protected topicName = "logs:connection-lifecycle";
  protected commandGroup = "logging";

  static override description =
    "Stream logs from [meta]connection.lifecycle meta channel";

  static override examples = [
    "ably logs connection-lifecycle subscribe",
    "ably logs connection-lifecycle subscribe --rewind 10",
  ];
}
