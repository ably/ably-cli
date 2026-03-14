import { BaseTopicCommand } from "../../../base-topic-command.js";

export default class PushConfig extends BaseTopicCommand {
  protected topicName = "push:config";
  protected commandGroup = "Push configuration";

  static override description =
    "Manage push notification configuration (APNs, FCM)";

  static override examples = [
    "<%= config.bin %> <%= command.id %> show",
    "<%= config.bin %> <%= command.id %> set-apns --certificate /path/to/cert.p12",
    "<%= config.bin %> <%= command.id %> set-fcm --service-account /path/to/service-account.json",
  ];
}
