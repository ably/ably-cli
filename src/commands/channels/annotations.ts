import { BaseTopicCommand } from "../../base-topic-command.js";

export default class ChannelsAnnotations extends BaseTopicCommand {
  protected topicName = "channels:annotations";
  protected commandGroup = "channel annotations";

  static override description = "Manage annotations on Ably channel messages";

  static override examples = [
    "$ ably channels annotations publish my-channel msg-serial-123 reactions:flag.v1",
    "$ ably channels annotations delete my-channel msg-serial-123 reactions:flag.v1",
    "$ ably channels annotations get my-channel msg-serial-123",
    "$ ably channels annotations subscribe my-channel",
  ];
}
