import { BaseTopicCommand } from "../../base-topic-command.js";

export default class Skills extends BaseTopicCommand {
  protected topicName = "skills";
  protected commandGroup = "Agent Skills";

  static override description = "Install Ably Agent Skills for AI coding tools";

  static override examples = [
    "<%= config.bin %> <%= command.id %> install",
    "<%= config.bin %> <%= command.id %> install --target claude-code",
  ];
}
