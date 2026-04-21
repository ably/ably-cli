import { BaseTopicCommand } from "../../../base-topic-command.js";

export default class RulesIndexCommand extends BaseTopicCommand {
  protected topicName = "apps:rules";
  protected commandGroup = "rules";

  static description = "Manage Ably rules (namespaces)";

  static examples = [
    "$ ably apps rules list",
    '$ ably apps rules create "chat" --persisted',
    '$ ably apps rules update "chat" --push-enabled',
    '$ ably apps rules delete "chat"',
  ];
}
