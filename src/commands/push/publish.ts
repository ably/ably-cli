import { Flags } from "@oclif/core";
import { AblyBaseCommand } from "../../base-command.js";
import chalk from "chalk";
import * as fs from "node:fs";
import * as path from "node:path";

export default class PushPublish extends AblyBaseCommand {
  static override description =
    "Publish a push notification directly to device(s) or client(s) (maps to push.admin.publish)";

  static override examples = [
    // Simple notification to a device
    '$ ably push publish --device-id my-device --title "Hello" --body "World"',
    // Notification to all devices of a client
    '$ ably push publish --client-id user-123 --title "Alert" --body "New message"',
    // With custom data payload
    '$ ably push publish --device-id my-device --title "Order" --body "Shipped" --data \'{"orderId":"123"}\'',
    // iOS-specific with badge
    '$ ably push publish --device-id my-device --title "Messages" --body "3 unread" --badge 3',
    // Full payload from file
    "$ ably push publish --device-id my-device --payload ./notification.json",
    // Full payload inline
    '$ ably push publish --device-id my-device --payload \'{"notification":{"title":"Hi","body":"Hello"}}\'',
  ];

  static override flags = {
    ...AblyBaseCommand.globalFlags,
    "device-id": Flags.string({
      description: "Target device ID",
    }),
    "client-id": Flags.string({
      description: "Target client ID (sends to all client's devices)",
    }),
    title: Flags.string({
      description: "Notification title",
    }),
    body: Flags.string({
      description: "Notification body",
    }),
    sound: Flags.string({
      description: "Notification sound (default, or filename)",
    }),
    icon: Flags.string({
      description: "Notification icon (Android/Web)",
    }),
    badge: Flags.integer({
      description: "Badge count (iOS)",
    }),
    data: Flags.string({
      description: "Custom data payload as JSON string",
    }),
    payload: Flags.string({
      description:
        "Full notification payload as JSON string or path to JSON file",
    }),
    "collapse-key": Flags.string({
      description: "Collapse key for notification grouping",
    }),
    ttl: Flags.integer({
      description: "Time-to-live in seconds",
    }),
    apns: Flags.string({
      description: "APNs-specific overrides as JSON",
    }),
    fcm: Flags.string({
      description: "FCM-specific overrides as JSON",
    }),
    web: Flags.string({
      description: "Web Push-specific overrides as JSON",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushPublish);

    // Validate recipient
    if (!flags["device-id"] && !flags["client-id"]) {
      this.error("Either --device-id or --client-id must be specified");
    }

    if (flags["device-id"] && flags["client-id"]) {
      this.error(
        "Only one of --device-id or --client-id can be specified, not both",
      );
    }

    // Validate payload options
    // When using --payload, all other notification flags are ignored since --payload
    // provides the complete notification structure
    const notificationFlags = [
      "title",
      "body",
      "sound",
      "icon",
      "badge",
      "data",
      "collapse-key",
      "ttl",
      "apns",
      "fcm",
      "web",
    ];
    const usedNotificationFlags = notificationFlags.filter(
      (flag) => flags[flag] !== undefined,
    );

    if (flags.payload && usedNotificationFlags.length > 0) {
      this.error(
        `Cannot use --payload with ${usedNotificationFlags.map((f) => `--${f}`).join(", ")}. ` +
          `Use --payload for full control OR individual flags for simple notifications, not both.`,
      );
    }

    if (!flags.payload && !flags.title && !flags.body) {
      this.error(
        "Either --payload or at least one of --title/--body must be specified",
      );
    }

    try {
      const rest = await this.createAblyRestClient(flags);
      if (!rest) {
        return;
      }

      // Build recipient
      const recipient: Record<string, string> = {};
      if (flags["device-id"]) {
        recipient.deviceId = flags["device-id"];
      } else if (flags["client-id"]) {
        recipient.clientId = flags["client-id"];
      }

      // Build payload
      let pushPayload: Record<string, unknown>;

      if (flags.payload) {
        pushPayload = this.parsePayload(flags.payload);
      } else {
        pushPayload = this.buildPayload(flags);
      }

      // Publish the notification
      await rest.push.admin.publish(recipient, pushPayload);

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              recipient: {
                deviceId: flags["device-id"],
                clientId: flags["client-id"],
              },
              published: true,
              success: true,
              timestamp: new Date().toISOString(),
            },
            flags,
          ),
        );
      } else {
        const target = flags["device-id"]
          ? `device ${chalk.cyan(flags["device-id"])}`
          : `client ${chalk.cyan(flags["client-id"])}`;

        this.log(
          chalk.green(`Push notification sent successfully to ${target}`),
        );

        if (flags.title) {
          this.log(`${chalk.dim("Title:")} ${flags.title}`);
        }

        if (flags.body) {
          this.log(`${chalk.dim("Body:")}  ${flags.body}`);
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorCode = (error as { code?: number }).code;

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              error: errorMessage,
              code: errorCode,
              success: false,
            },
            flags,
          ),
        );
        this.exit(1);
      } else {
        if (errorCode === 40400) {
          this.error(
            `Device or client not found. Ensure the device/client is registered first.`,
          );
        } else {
          this.error(`Error publishing notification: ${errorMessage}`);
        }
      }
    }
  }

  private parsePayload(payload: string): Record<string, unknown> {
    let jsonString = payload;

    // Check if it's a file path
    if (!payload.trim().startsWith("{") && !payload.trim().startsWith("[")) {
      const filePath = path.resolve(payload);

      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      jsonString = fs.readFileSync(filePath, "utf8");
    }

    try {
      return JSON.parse(jsonString) as Record<string, unknown>;
    } catch {
      throw new Error("Invalid JSON format in --payload");
    }
  }

  private buildPayload(
    flags: Record<string, unknown>,
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    // Build notification object
    const notification: Record<string, unknown> = {};

    if (flags.title) {
      notification.title = flags.title as string;
    }

    if (flags.body) {
      notification.body = flags.body as string;
    }

    if (flags.sound) {
      notification.sound = flags.sound as string;
    }

    if (flags.icon) {
      notification.icon = flags.icon as string;
    }

    if (flags.badge !== undefined) {
      notification.badge = flags.badge as number;
    }

    if (flags["collapse-key"]) {
      notification.collapseKey = flags["collapse-key"] as string;
    }

    if (flags.ttl !== undefined) {
      notification.ttl = flags.ttl as number;
    }

    if (Object.keys(notification).length > 0) {
      payload.notification = notification;
    }

    // Add custom data
    if (flags.data) {
      try {
        payload.data = JSON.parse(flags.data as string);
      } catch {
        throw new Error("Invalid JSON format in --data");
      }
    }

    // Add platform-specific overrides
    if (flags.apns) {
      try {
        payload.apns = JSON.parse(flags.apns as string);
      } catch {
        throw new Error("Invalid JSON format in --apns");
      }
    }

    if (flags.fcm) {
      try {
        payload.fcm = JSON.parse(flags.fcm as string);
      } catch {
        throw new Error("Invalid JSON format in --fcm");
      }
    }

    if (flags.web) {
      try {
        payload.web = JSON.parse(flags.web as string);
      } catch {
        throw new Error("Invalid JSON format in --web");
      }
    }

    return payload;
  }
}
