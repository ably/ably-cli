import { BaseTopicCommand } from "../../../base-topic-command.js";

export default class LogsPushIndexCommand extends BaseTopicCommand {
  protected topicName = "logs:push";
  protected commandGroup = "logging";

  static override description =
    "Stream or retrieve push notification logs from [meta]log:push";

  static override examples = [
    "$ ably logs push subscribe",
    "$ ably logs push subscribe --rewind 10",
    "$ ably logs push history",
  ];
}
