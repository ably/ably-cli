import { Flags } from "@oclif/core";

import { AblyBaseCommand } from "../../base-command.js";
import { productApiFlags } from "../../flags.js";
import { BaseFlags } from "../../types/cli.js";
import { formatProgress, formatSuccess } from "../../utils/output.js";

export default class PushPublish extends AblyBaseCommand {
  static override description =
    "Publish a push notification to a device or client";

  static override examples = [
    "<%= config.bin %> <%= command.id %> --device-id device-123 --title Hello --body World",
    "<%= config.bin %> <%= command.id %> --client-id client-1 --title Hello --body World",
    '<%= config.bin %> <%= command.id %> --device-id device-123 --payload \'{"notification":{"title":"Hello","body":"World"}}\'',
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
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushPublish);

    if (!flags["device-id"] && !flags["client-id"] && !flags.recipient) {
      this.fail(
        "A recipient is required: --device-id, --client-id, or --recipient",
        flags as BaseFlags,
        "pushPublish",
      );
    }

    try {
      const rest = await this.createAblyRestClient(flags as BaseFlags);
      if (!rest) return;

      // Build recipient
      let recipient: Record<string, unknown>;
      if (flags["device-id"]) {
        recipient = { deviceId: flags["device-id"] };
      } else if (flags["client-id"]) {
        recipient = { clientId: flags["client-id"] };
      } else {
        try {
          const parsed = JSON.parse(flags.recipient!);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("not an object");
          }
          recipient = parsed as Record<string, unknown>;
        } catch {
          this.fail(
            "--recipient must be a valid JSON object",
            flags as BaseFlags,
            "pushPublish",
          );
        }
      }

      // Build notification payload
      let payload: Record<string, unknown>;
      if (flags.payload) {
        try {
          const parsed = JSON.parse(flags.payload);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("not an object");
          }
          payload = parsed as Record<string, unknown>;
        } catch {
          this.fail(
            "--payload must be a valid JSON object",
            flags as BaseFlags,
            "pushPublish",
          );
        }
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
          try {
            const parsed = JSON.parse(flags.data);
            if (
              !parsed ||
              typeof parsed !== "object" ||
              Array.isArray(parsed)
            ) {
              throw new Error("not an object");
            }
            payload.data = parsed;
          } catch {
            this.fail(
              "--data must be a valid JSON object",
              flags as BaseFlags,
              "pushPublish",
            );
          }
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
        try {
          const parsed = JSON.parse(flags.apns);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("not an object");
          }
          payload.apns = parsed;
        } catch {
          this.fail(
            "--apns must be a valid JSON object",
            flags as BaseFlags,
            "pushPublish",
          );
        }
      }
      if (flags.fcm) {
        try {
          const parsed = JSON.parse(flags.fcm);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("not an object");
          }
          payload.fcm = parsed;
        } catch {
          this.fail(
            "--fcm must be a valid JSON object",
            flags as BaseFlags,
            "pushPublish",
          );
        }
      }
      if (flags.web) {
        try {
          const parsed = JSON.parse(flags.web);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("not an object");
          }
          payload.web = parsed;
        } catch {
          this.fail(
            "--web must be a valid JSON object",
            flags as BaseFlags,
            "pushPublish",
          );
        }
      }

      if (!this.shouldOutputJson(flags)) {
        this.log(formatProgress("Publishing push notification"));
      }

      await rest.push.admin.publish(recipient!, payload);

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult({ published: true, recipient: recipient! }, flags);
      } else {
        this.log(formatSuccess("Push notification published."));
      }
    } catch (error) {
      this.fail(error, flags as BaseFlags, "pushPublish");
    }
  }
}
