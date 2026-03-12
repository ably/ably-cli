import { BaseTopicCommand } from "../../../base-topic-command.js";

export default class ChannelsAnnotations extends BaseTopicCommand {
  protected topicName = "channels:annotations";
  protected commandGroup = "Pub/Sub channel annotations";

  static override description =
    "Manage annotations on Ably Pub/Sub channel messages";

  static override examples = [
    '<%= config.bin %> <%= command.id %> publish my-channel "01234567890:0" "reactions:flag.v1" --name thumbsup',
    "<%= config.bin %> <%= command.id %> subscribe my-channel",
    '<%= config.bin %> <%= command.id %> get my-channel "01234567890:0"',
  ];
}
