import { BaseTopicCommand } from "../../base-topic-command.js";

export default class AiTransportIndex extends BaseTopicCommand {
  protected topicName = "ai-transport";
  protected commandGroup = "AI Transport";

  static override description = "Interact with Ably AI Transport";

  static override examples = [
    "<%= config.bin %> <%= command.id %> demo streaming",
    "<%= config.bin %> <%= command.id %> demo barge-in",
  ];
}
