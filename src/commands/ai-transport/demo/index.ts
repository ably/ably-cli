import { BaseTopicCommand } from "../../../base-topic-command.js";

export default class AiTransportDemoIndex extends BaseTopicCommand {
  protected topicName = "ai-transport:demo";
  protected commandGroup = "AI Transport demo";

  static override description = "Interactive demos of AI Transport features";

  static override examples = [
    "<%= config.bin %> <%= command.id %> streaming",
    "<%= config.bin %> <%= command.id %> barge-in",
    "<%= config.bin %> <%= command.id %> cancel",
  ];
}
