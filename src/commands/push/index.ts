import { BaseTopicCommand } from "../../base-topic-command.js";

export default class PushIndexCommand extends BaseTopicCommand {
  protected topicName = "push";
  protected commandGroup = "push notifications";

  static description = "Manage Ably Push Notifications";

  static examples = [
    "<%= config.bin %> <%= command.id %> set-apns-p12 APP_ID --certificate /path/to/cert.p12",
  ];
}
