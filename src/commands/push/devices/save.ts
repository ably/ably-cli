import { Flags } from "@oclif/core";
import * as fs from "node:fs";
import * as path from "node:path";

import { AblyBaseCommand } from "../../../base-command.js";
import { productApiFlags } from "../../../flags.js";
import { BaseFlags } from "../../../types/cli.js";
import { formatResource } from "../../../utils/output.js";

export default class PushDevicesSave extends AblyBaseCommand {
  static override description = "Register or update a push device";

  static override examples = [
    "<%= config.bin %> <%= command.id %> --id device-123 --platform ios --form-factor phone --transport-type apns --device-token token123",
    "<%= config.bin %> <%= command.id %> --id browser-1 --platform browser --form-factor desktop --transport-type web --target-url https://push.example.com --p256dh-key KEY --auth-secret SECRET",
    '<%= config.bin %> <%= command.id %> --data \'{"id":"device-123","platform":"ios","formFactor":"phone","push":{"recipient":{"transportType":"apns","deviceToken":"token123"}}}\'',
    "<%= config.bin %> <%= command.id %> --data @device.json",
    "<%= config.bin %> <%= command.id %> --id device-123 --platform ios --form-factor phone --transport-type apns --device-token token123 --json",
  ];

  static override flags = {
    ...productApiFlags,
    id: Flags.string({
      description: "Device ID",
    }),
    platform: Flags.string({
      description: "Device platform",
      options: ["ios", "android", "browser"],
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
    "transport-type": Flags.string({
      description: "Push transport type",
      options: ["apns", "fcm", "web"],
    }),
    "device-token": Flags.string({
      description: "Push device token (required for apns/fcm transport)",
    }),
    "target-url": Flags.string({
      description: "Web push target URL (required for web transport)",
    }),
    "p256dh-key": Flags.string({
      description: "Web push P256DH key (required for web transport)",
    }),
    "auth-secret": Flags.string({
      description: "Web push auth secret (required for web transport)",
    }),
    "client-id": Flags.string({
      description: "Client ID to associate with the device",
    }),
    metadata: Flags.string({
      description: "Device metadata as JSON",
    }),
    data: Flags.string({
      description: "Full device details as JSON string or @filepath",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushDevicesSave);

    try {
      const rest = await this.createAblyRestClient(flags as BaseFlags);
      if (!rest) return;

      let deviceData: Record<string, unknown>;

      if (flags.data) {
        deviceData = this.parseDataFlag(flags.data, flags);
      } else {
        if (!flags.id) {
          this.fail(
            "--id is required when not using --data",
            flags as BaseFlags,
            "pushDeviceSave",
          );
        }
        if (!flags.platform) {
          this.fail(
            "--platform is required when not using --data",
            flags as BaseFlags,
            "pushDeviceSave",
          );
        }
        if (!flags["form-factor"]) {
          this.fail(
            "--form-factor is required when not using --data",
            flags as BaseFlags,
            "pushDeviceSave",
          );
        }
        if (!flags["transport-type"]) {
          this.fail(
            "--transport-type is required when not using --data",
            flags as BaseFlags,
            "pushDeviceSave",
          );
        }

        const transportType = flags["transport-type"];
        let recipient: Record<string, unknown>;

        if (transportType === "web") {
          if (!flags["target-url"]) {
            this.fail(
              "--target-url is required for web transport",
              flags as BaseFlags,
              "pushDeviceSave",
            );
          }
          if (!flags["p256dh-key"]) {
            this.fail(
              "--p256dh-key is required for web transport",
              flags as BaseFlags,
              "pushDeviceSave",
            );
          }
          if (!flags["auth-secret"]) {
            this.fail(
              "--auth-secret is required for web transport",
              flags as BaseFlags,
              "pushDeviceSave",
            );
          }
          recipient = {
            transportType: "web",
            targetUrl: flags["target-url"],
            encryptionKey: {
              p256dh: flags["p256dh-key"],
              auth: flags["auth-secret"],
            },
          };
        } else {
          if (!flags["device-token"]) {
            this.fail(
              "--device-token is required for apns/fcm transport",
              flags as BaseFlags,
              "pushDeviceSave",
            );
          }
          recipient = {
            transportType,
            ...(transportType === "fcm"
              ? { registrationToken: flags["device-token"] }
              : { deviceToken: flags["device-token"] }),
          };
        }

        deviceData = {
          id: flags.id,
          platform: flags.platform,
          formFactor: flags["form-factor"],
          push: { recipient },
        };

        if (flags["client-id"]) {
          deviceData.clientId = flags["client-id"];
        }

        if (flags.metadata) {
          deviceData.metadata = this.parseJsonObjectFlag(
            flags.metadata,
            "--metadata",
            flags as BaseFlags,
          );
        }
      }

      this.logProgress(
        `Saving device registration ${formatResource(typeof deviceData.id === "string" ? deviceData.id : "")}`,
        flags,
      );

      const result = await rest.push.admin.deviceRegistrations.save(
        deviceData as never,
      );

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult({ device: result }, flags);
      } else {
        this.logSuccessMessage(
          `Device registration saved for ${formatResource(typeof deviceData.id === "string" ? deviceData.id : "")}.`,
          flags,
        );
      }
    } catch (error) {
      this.fail(error, flags as BaseFlags, "pushDeviceSave");
    }
  }

  private parseDataFlag(
    data: string,
    flags: Record<string, unknown>,
  ): Record<string, unknown> {
    let jsonString = data;

    if (data.startsWith("@")) {
      const filePath = path.resolve(data.slice(1));
      if (!fs.existsSync(filePath)) {
        this.fail(
          `File not found: ${filePath}`,
          flags as BaseFlags,
          "pushDeviceSave",
        );
      }
      jsonString = fs.readFileSync(filePath, "utf8");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      this.fail(
        "--data must be valid JSON or a path to a JSON file (prefixed with @)",
        flags as BaseFlags,
        "pushDeviceSave",
      );
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      this.fail(
        "--data must be a JSON object",
        flags as BaseFlags,
        "pushDeviceSave",
      );
    }

    return parsed as Record<string, unknown>;
  }
}
