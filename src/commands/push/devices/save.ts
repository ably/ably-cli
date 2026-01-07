import { Flags } from "@oclif/core";
import { AblyBaseCommand } from "../../../base-command.js";
import * as Ably from "ably";
import chalk from "chalk";
import * as fs from "node:fs";
import * as path from "node:path";

export default class PushDevicesSave extends AblyBaseCommand {
  static override description =
    "Register a new device or update an existing device registration (maps to push.admin.deviceRegistrations.save)";

  static override examples = [
    // Android FCM
    "$ ably push devices save --id my-device --platform android --form-factor phone --transport-type fcm --device-token FCM_REGISTRATION_TOKEN",
    // iOS APNs
    "$ ably push devices save --id my-device --platform ios --form-factor phone --transport-type apns --device-token APNS_DEVICE_TOKEN",
    // Web Push (browser)
    "$ ably push devices save --id my-device --platform browser --form-factor desktop --transport-type web --target-url https://fcm.googleapis.com/fcm/send/... --p256dh-key BASE64_P256DH_KEY --auth-secret BASE64_AUTH_SECRET",
    // With client ID
    "$ ably push devices save --id my-device --platform android --form-factor phone --transport-type fcm --device-token TOKEN --recipient-client-id user-123",
    // From JSON file
    "$ ably push devices save --data ./device.json",
    // From inline JSON
    '$ ably push devices save --data \'{"id":"device-1","platform":"android","formFactor":"phone","push":{"recipient":{"transportType":"fcm","registrationToken":"TOKEN"}}}\'',
  ];

  static override flags = {
    ...AblyBaseCommand.globalFlags,
    id: Flags.string({
      description: "Unique device identifier",
    }),
    platform: Flags.string({
      description: "Device platform",
      options: ["android", "ios", "browser"],
    }),
    "form-factor": Flags.string({
      description: "Device form factor",
      options: [
        "phone",
        "tablet",
        "desktop",
        "tv",
        "watch",
        "car",
        "embedded",
        "other",
      ],
    }),
    "recipient-client-id": Flags.string({
      description: "Client ID to associate with the device",
    }),
    "transport-type": Flags.string({
      description:
        "Push transport type (fcm for Android, apns for iOS, web for browsers)",
      options: ["fcm", "apns", "web"],
    }),
    "device-token": Flags.string({
      description:
        "Device token for APNs (iOS) or FCM registration token (Android). Not used for web push.",
    }),
    "target-url": Flags.string({
      description:
        "Web push endpoint URL (from PushSubscription.endpoint). Required for web transport type.",
    }),
    "p256dh-key": Flags.string({
      description:
        "Web push p256dh public key (from PushSubscription.getKey('p256dh'), base64 encoded). Required for web transport type.",
    }),
    "auth-secret": Flags.string({
      description:
        "Web push auth secret (from PushSubscription.getKey('auth'), base64 encoded). Required for web transport type.",
    }),
    metadata: Flags.string({
      description: "Device metadata as JSON string",
    }),
    data: Flags.string({
      description: "Full device details as JSON string or path to JSON file",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushDevicesSave);

    try {
      const rest = await this.createAblyRestClient(flags);
      if (!rest) {
        return;
      }

      let deviceDetails: Ably.DeviceDetails;

      if (flags.data) {
        // Parse device details from JSON string or file
        deviceDetails = this.parseDeviceData(flags.data);
      } else {
        // Build device details from individual flags
        deviceDetails = this.buildDeviceDetails(flags);
      }

      // Validate required fields
      this.validateDeviceDetails(deviceDetails);

      // Save the device
      const savedDevice =
        await rest.push.admin.deviceRegistrations.save(deviceDetails);

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              device: {
                id: savedDevice.id,
                platform: savedDevice.platform,
                formFactor: savedDevice.formFactor,
                clientId: savedDevice.clientId,
                state: savedDevice.push?.state,
              },
              success: true,
              timestamp: new Date().toISOString(),
            },
            flags,
          ),
        );
      } else {
        this.log(
          chalk.green(`Device registered successfully: ${savedDevice.id}`),
        );
        this.log("");
        this.log(`${chalk.dim("Platform:")}     ${savedDevice.platform}`);
        this.log(`${chalk.dim("Form Factor:")}  ${savedDevice.formFactor}`);

        if (savedDevice.clientId) {
          this.log(`${chalk.dim("Client ID:")}    ${savedDevice.clientId}`);
        }

        if (savedDevice.push?.state) {
          this.log(
            `${chalk.dim("State:")}        ${chalk.green(savedDevice.push.state)}`,
          );
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
        this.error(`Error saving device: ${errorMessage}`);
      }
    }
  }

  private parseDeviceData(data: string): Ably.DeviceDetails {
    let jsonString = data;

    // Check if it's a file path
    if (!data.trim().startsWith("{")) {
      const filePath = path.resolve(data);

      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      jsonString = fs.readFileSync(filePath, "utf8");
    }

    try {
      return JSON.parse(jsonString) as Ably.DeviceDetails;
    } catch {
      throw new Error("Invalid JSON format in --data");
    }
  }

  private buildDeviceDetails(
    flags: Record<string, unknown>,
  ): Ably.DeviceDetails {
    if (!flags.id) {
      throw new Error("--id is required when not using --data");
    }

    if (!flags.platform) {
      throw new Error("--platform is required when not using --data");
    }

    if (!flags["form-factor"]) {
      throw new Error("--form-factor is required when not using --data");
    }

    if (!flags["transport-type"]) {
      throw new Error("--transport-type is required when not using --data");
    }

    const transportType = flags["transport-type"] as string;

    // Validate transport-specific required flags
    if (transportType === "web") {
      if (!flags["target-url"]) {
        throw new Error("--target-url is required for web transport type");
      }

      if (!flags["p256dh-key"]) {
        throw new Error("--p256dh-key is required for web transport type");
      }

      if (!flags["auth-secret"]) {
        throw new Error("--auth-secret is required for web transport type");
      }
    } else {
      if (!flags["device-token"]) {
        throw new Error(
          "--device-token is required for fcm and apns transport types",
        );
      }
    }

    const device: Ably.DeviceDetails = {
      id: flags.id as string,
      platform: flags.platform as Ably.DevicePlatform,
      formFactor: flags["form-factor"] as Ably.DeviceFormFactor,
      push: {
        recipient: this.buildRecipient(transportType, flags),
      },
    };

    if (flags["recipient-client-id"]) {
      device.clientId = flags["recipient-client-id"] as string;
    }

    if (flags.metadata) {
      try {
        device.metadata = JSON.parse(flags.metadata as string);
      } catch {
        throw new Error("Invalid JSON format in --metadata");
      }
    }

    return device;
  }

  private buildRecipient(
    transportType: string,
    flags: Record<string, unknown>,
  ): Record<string, unknown> {
    const recipient: Record<string, unknown> = {
      transportType,
    };

    switch (transportType) {
      case "fcm": {
        recipient.registrationToken = flags["device-token"] as string;
        break;
      }

      case "apns": {
        recipient.deviceToken = flags["device-token"] as string;
        break;
      }

      case "web": {
        // Web push requires targetUrl and encryptionKey object with p256dh and auth
        recipient.targetUrl = flags["target-url"] as string;
        recipient.encryptionKey = {
          p256dh: flags["p256dh-key"] as string,
          auth: flags["auth-secret"] as string,
        };
        break;
      }

      default: {
        throw new Error(`Unsupported transport type: ${transportType}`);
      }
    }

    return recipient;
  }

  private validateDeviceDetails(device: Ably.DeviceDetails): void {
    if (!device.id) {
      throw new Error("Device ID is required");
    }

    if (!device.platform) {
      throw new Error("Device platform is required");
    }

    if (!device.formFactor) {
      throw new Error("Device form factor is required");
    }

    if (!device.push?.recipient) {
      throw new Error("Push recipient configuration is required");
    }

    const recipient = device.push.recipient as Record<string, unknown>;

    if (!recipient.transportType) {
      throw new Error("Transport type is required in push recipient");
    }

    // Validate transport-specific fields
    switch (recipient.transportType) {
      case "fcm": {
        if (!recipient.registrationToken) {
          throw new Error("FCM registrationToken is required");
        }

        break;
      }

      case "apns": {
        if (!recipient.deviceToken) {
          throw new Error("APNs deviceToken is required");
        }

        break;
      }

      case "web": {
        if (!recipient.targetUrl) {
          throw new Error("Web push targetUrl is required");
        }

        if (!recipient.encryptionKey) {
          throw new Error("Web push encryptionKey is required");
        }

        const encryptionKey = recipient.encryptionKey as Record<
          string,
          unknown
        >;

        if (!encryptionKey.p256dh) {
          throw new Error("Web push encryptionKey.p256dh is required");
        }

        if (!encryptionKey.auth) {
          throw new Error("Web push encryptionKey.auth is required");
        }

        break;
      }
    }
  }
}
