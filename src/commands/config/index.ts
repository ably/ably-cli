import { BaseTopicCommand } from "../../base-topic-command.js";

export default class ConfigIndex extends BaseTopicCommand {
  protected topicName = "config";
  protected commandGroup = "Configuration";

  static override description = "Manage Ably CLI configuration";

  static override examples = [
    "<%= config.bin %> <%= command.id %> path",
    "<%= config.bin %> <%= command.id %> show",
  ];
}
