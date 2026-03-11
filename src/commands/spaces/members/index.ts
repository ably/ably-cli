import { BaseTopicCommand } from "../../../base-topic-command.js";

export default class SpacesMembersIndex extends BaseTopicCommand {
  protected topicName = "spaces:members";
  protected commandGroup = "Spaces member";

  static override description = "Commands for managing members in Ably Spaces";

  static override examples = [
    "<%= config.bin %> <%= command.id %> enter my-space",
    "<%= config.bin %> <%= command.id %> subscribe my-space",
    "<%= config.bin %> <%= command.id %> get-all my-space",
  ];
}
