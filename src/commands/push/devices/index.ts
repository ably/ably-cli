import { BaseTopicCommand } from "../../../base-topic-command.js";

export default class PushDevices extends BaseTopicCommand {
  protected topicName = "push:devices";
  protected commandGroup = "push device registration";

  static override description =
    "Manage push notification device registrations (maps to push.admin.deviceRegistrations)";

  static override examples = [
    "<%= config.bin %> <%= command.id %> list",
    "<%= config.bin %> <%= command.id %> list --client-id user-123",
    "<%= config.bin %> <%= command.id %> get DEVICE_ID",
    "<%= config.bin %> <%= command.id %> save --id my-device --platform android --form-factor phone --transport-type fcm --device-token TOKEN",
    "<%= config.bin %> <%= command.id %> remove DEVICE_ID",
    "<%= config.bin %> <%= command.id %> remove-where --client-id user-123",
  ];
}
