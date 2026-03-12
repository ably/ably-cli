import { BaseTopicCommand } from "../../../base-topic-command.js";

export default class PushDevices extends BaseTopicCommand {
  protected topicName = "push:devices";
  protected commandGroup = "Push device registration";

  static override description = "Manage push notification device registrations";

  static override examples = [
    "<%= config.bin %> <%= command.id %> list",
    "<%= config.bin %> <%= command.id %> get device-123",
    "<%= config.bin %> <%= command.id %> save --id device-123 --platform ios --form-factor phone --transport-type apns --device-token token123",
  ];
}
