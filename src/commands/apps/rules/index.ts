import { BaseTopicCommand } from "../../../base-topic-command.js";

export default class RulesIndexCommand extends BaseTopicCommand {
  protected topicName = "apps:rules";
  protected commandGroup = "channel rules";

  static description = "Manage Ably channel rules (namespaces)";

  static examples = [
    "$ ably apps rules list",
    '$ ably apps rules create --name "chat" --persisted',
    "$ ably apps rules update chat --push-enabled",
    "$ ably apps rules delete chat",
  ];
}
