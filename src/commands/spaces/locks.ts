import { BaseTopicCommand } from "../../base-topic-command.js";

export default class SpacesLocks extends BaseTopicCommand {
  protected topicName = "spaces:locks";
  protected commandGroup = "Spaces lock";

  static override description = "Commands for component locking in Ably Spaces";

  static override examples = [
    "<%= config.bin %> <%= command.id %> acquire my-space my-lock-id",
    "<%= config.bin %> <%= command.id %> subscribe my-space",
    "<%= config.bin %> <%= command.id %> get my-space my-lock-id",
    "<%= config.bin %> <%= command.id %> get-all my-space",
  ];
}
