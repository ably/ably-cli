import { BaseTopicCommand } from "../../../base-topic-command.js";

export default class PushConfig extends BaseTopicCommand {
  protected topicName = "push:config";
  protected commandGroup = "push notification configuration";

  static override description =
    "Manage push notification configuration (APNs and FCM credentials)";

  static override examples = [
    "<%= config.bin %> <%= command.id %> show",
    "<%= config.bin %> <%= command.id %> set-apns --certificate ./cert.p12 --password SECRET",
    "<%= config.bin %> <%= command.id %> clear-apns --force",
  ];
}
