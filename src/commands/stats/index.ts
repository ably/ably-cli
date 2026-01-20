import { BaseTopicCommand } from "../../base-topic-command.js";

export default class StatsCommand extends BaseTopicCommand {
  protected topicName = "stats";
  protected commandGroup = "stats";

  static description = "View statistics for your Ably account or apps";

  static examples = [
    "$ ably stats account",
    "$ ably stats account --unit hour",
    "$ ably stats account --live",
    "$ ably stats app",
    "$ ably stats app my-app-id",
    "$ ably stats app --live",
  ];
}
