import { Flags } from "@oclif/core";
import * as fs from "node:fs";
import * as path from "node:path";

import { AblyBaseCommand } from "../../base-command.js";
import { forceFlag, productApiFlags } from "../../flags.js";
import { BaseFlags } from "../../types/cli.js";
import { formatResource } from "../../utils/output.js";
import { promptForConfirmation } from "../../utils/prompt-confirmation.js";

export default class PushPublish extends AblyBaseCommand {
  static override description =
    "Publish a push notification to a device, client, or channel";

  static override examples = [
    "<%= config.bin %> <%= command.id %> --device-id device-123 --title Hello --body World",
    '<%= config.bin %> <%= command.id %> --device-id device-123 --title Hello --body World --data \'{"key":"value"}\'',
    '<%= config.bin %> <%= command.id %> --device-id device-123 --payload \'{"notification":{"title":"Hello","body":"World"}}\'',
    "<%= config.bin %> <%= command.id %> --device-id device-123 --payload ./notification.json",
    "<%= config.bin %> <%= command.id %> --client-id client-1 --title Hello --body World",
    '<%= config.bin %> <%= command.id %> --client-id client-1 --payload \'{"notification":{"title":"Hello","body":"World"}}\'',
    "<%= config.bin %> <%= command.id %> --channel my-channel --title Hello --body World",
    '<%= config.bin %> <%= command.id %> --channel my-channel --title Hello --body World --data \'{"key":"value"}\'',
    '<%= config.bin %> <%= command.id %> --channel my-channel --payload \'{"notification":{"title":"Hello","body":"World"},"data":{"key":"value"}}\'',
    "<%= config.bin %> <%= command.id %> --channel my-channel --payload ./notification.json",
    '<%= config.bin %> <%= command.id %> --recipient \'{"transportType":"apns","deviceToken":"token123"}\' --title Hello --body World',
    "<%= config.bin %> <%= command.id %> --device-id device-123 --title Hello --body World --json",
  ];

  static override flags = {
    ...productApiFlags,
    "device-id": Flags.string({
      description: "Target device ID",
      exclusive: ["client-id", "recipient"],
    }),
    "client-id": Flags.string({
      description: "Target client ID",
      exclusive: ["device-id", "recipient"],
    }),
    recipient: Flags.string({
      description: "Raw recipient JSON for advanced targeting",
      exclusive: ["device-id", "client-id"],
    }),
    channel: Flags.string({
      description:
        "Target channel name (publishes push notification via the channel using extras.push; ignored if --device-id, --client-id, or --recipient is also provided)",
    }),
    title: Flags.string({
      description: "Notification title",
    }),
    body: Flags.string({
      description: "Notification body",
    }),
    sound: Flags.string({
      description: "Notification sound",
    }),
    icon: Flags.string({
      description: "Notification icon",
    }),
    badge: Flags.integer({
      description: "Notification badge count",
    }),
    data: Flags.string({
      description: "Custom data payload as JSON",
    }),
    "collapse-key": Flags.string({
      description: "Collapse key for notification grouping",
    }),
    ttl: Flags.integer({
      description: "Time to live in seconds",
    }),
    payload: Flags.string({
      description:
        "Full notification payload as JSON (overrides convenience flags)",
    }),
    apns: Flags.string({
      description: "APNs-specific override as JSON",
    }),
    fcm: Flags.string({
      description: "FCM-specific override as JSON",
    }),
    web: Flags.string({
      description: "Web push-specific override as JSON",
    }),
    ...forceFlag,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushPublish);

    const hasDirectRecipient =
      flags["device-id"] || flags["client-id"] || flags.recipient;

    if (!hasDirectRecipient && !flags.channel) {
      this.fail(
        "A target is required: --device-id, --client-id, --recipient, or --channel",
        flags as BaseFlags,
        "pushPublish",
      );
    }

    if (hasDirectRecipient && flags.channel) {
      this.logWarning(
        "--channel is ignored when --device-id, --client-id, or --recipient is provided.",
        flags as BaseFlags,
      );
    }

    try {
      const rest = await this.createAblyRestClient(flags as BaseFlags);
      if (!rest) return;

      // Build recipient
      let recipient: Record<string, unknown> | undefined;
      if (flags["device-id"]) {
        recipient = { deviceId: flags["device-id"] };
      } else if (flags["client-id"]) {
        recipient = { clientId: flags["client-id"] };
      } else if (flags.recipient) {
        recipient = this.parseJsonObjectFlag(
          flags.recipient,
          "--recipient",
          flags as BaseFlags,
        );
      }

      // Build notification payload
      let payload: Record<string, unknown>;
      if (flags.payload) {
        let jsonString: string;
        if (flags.payload.startsWith("@")) {
          const filePath = path.resolve(flags.payload.slice(1));
          if (!fs.existsSync(filePath)) {
            this.fail(
              `File not found: ${filePath}`,
              flags as BaseFlags,
              "pushPublish",
            );
          }
          jsonString = fs.readFileSync(filePath, "utf8");
        } else if (
          flags.payload.startsWith("/") ||
          flags.payload.startsWith("./") ||
          flags.payload.startsWith("../")
        ) {
          const filePath = path.resolve(flags.payload);
          if (!fs.existsSync(filePath)) {
            this.fail(
              `File not found: ${filePath}`,
              flags as BaseFlags,
              "pushPublish",
            );
          }
          jsonString = fs.readFileSync(filePath, "utf8");
        } else if (fs.existsSync(path.resolve(flags.payload))) {
          jsonString = fs.readFileSync(path.resolve(flags.payload), "utf8");
        } else {
          jsonString = flags.payload;
        }
        payload = this.parseJsonObjectFlag(
          jsonString,
          "--payload",
          flags as BaseFlags,
        );
      } else {
        const notification: Record<string, unknown> = {};
        if (flags.title) notification.title = flags.title;
        if (flags.body) notification.body = flags.body;
        if (flags.sound) notification.sound = flags.sound;
        if (flags.icon) notification.icon = flags.icon;
        if (flags.badge !== undefined) notification.badge = flags.badge;
        if (flags["collapse-key"])
          notification.collapseKey = flags["collapse-key"];
        if (flags.ttl !== undefined) notification.ttl = flags.ttl;

        payload = {};
        if (Object.keys(notification).length > 0) {
          payload.notification = notification;
        }

        if (flags.data) {
          payload.data = this.parseJsonObjectFlag(
            flags.data,
            "--data",
            flags as BaseFlags,
          );
        }
      }

      // Validate that at least some payload content exists
      if (
        !payload!.notification &&
        !payload!.data &&
        Object.keys(payload!).length === 0
      ) {
        this.fail(
          "No push payload provided. Use --payload, --title/--body, or --data to specify notification content",
          flags as BaseFlags,
          "pushPublish",
        );
      }

      // Add platform-specific overrides
      if (flags.apns) {
        payload.apns = this.parseJsonObjectFlag(
          flags.apns,
          "--apns",
          flags as BaseFlags,
        );
      }
      if (flags.fcm) {
        payload.fcm = this.parseJsonObjectFlag(
          flags.fcm,
          "--fcm",
          flags as BaseFlags,
        );
      }
      if (flags.web) {
        payload.web = this.parseJsonObjectFlag(
          flags.web,
          "--web",
          flags as BaseFlags,
        );
      }

      this.logProgress("Publishing push notification", flags);

      if (recipient) {
        await rest.push.admin.publish(recipient, payload);

        if (this.shouldOutputJson(flags)) {
          this.logJsonResult(
            { notification: { published: true, recipient } },
            flags,
          );
        }

        this.logSuccessMessage("Push notification published.", flags);
      } else {
        const channelName = flags.channel!;

        if (!flags.force && this.shouldOutputJson(flags)) {
          this.fail(
            "The --force flag is required when using --json to confirm publishing",
            flags,
            "pushPublish",
          );
        }

        if (!this.shouldOutputJson(flags) && !flags.force) {
          const confirmed = await promptForConfirmation(
            `This will send a push notification to all devices subscribed to channel ${formatResource(channelName)}. Continue?`,
          );
          if (!confirmed) {
            this.logWarning("Publish cancelled.", flags);
            return;
          }
        }

        await rest.channels
          .get(channelName)
          .publish({ extras: { push: payload } });

        if (this.shouldOutputJson(flags)) {
          this.logJsonResult(
            { notification: { published: true, channel: channelName } },
            flags,
          );
        }

        this.logSuccessMessage(
          `Push notification published to channel: ${formatResource(channelName)}.`,
          flags,
        );
      }
    } catch (error) {
      this.fail(error, flags as BaseFlags, "pushPublish");
    }
  }
}
