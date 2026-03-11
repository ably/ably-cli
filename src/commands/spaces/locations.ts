import { BaseTopicCommand } from "../../base-topic-command.js";

export default class SpacesLocations extends BaseTopicCommand {
  protected topicName = "spaces:locations";
  protected commandGroup = "Spaces location";

  static override description =
    "Commands for location management in Ably Spaces";

  static override examples = [
    "<%= config.bin %> <%= command.id %> set my-space",
    "<%= config.bin %> <%= command.id %> subscribe my-space",
    "<%= config.bin %> <%= command.id %> get-all my-space",
  ];
}
