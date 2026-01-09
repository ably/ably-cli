import { Args } from "@oclif/core";
import { AblyBaseCommand } from "../../../base-command.js";
import chalk from "chalk";

export default class PushDevicesGet extends AblyBaseCommand {
  static override description =
    "Get details of a registered push notification device (maps to push.admin.deviceRegistrations.get)";

  static override examples = [
    "$ ably push devices get DEVICE_ID",
    "$ ably push devices get my-device-123",
    "$ ably push devices get my-device-123 --json",
  ];

  static override args = {
    deviceId: Args.string({
      description: "The device ID to retrieve",
      required: true,
    }),
  };

  static override flags = {
    ...AblyBaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(PushDevicesGet);

    try {
      const rest = await this.createAblyRestClient(flags);
      if (!rest) {
        return;
      }

      const device = await rest.push.admin.deviceRegistrations.get(
        args.deviceId,
      );

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              device: {
                id: device.id,
                platform: device.platform,
                formFactor: device.formFactor,
                clientId: device.clientId,
                state: device.push?.state,
                metadata: device.metadata,
                push: {
                  state: device.push?.state,
                  error: device.push?.error,
                  // Redact sensitive recipient info
                  recipient: device.push?.recipient
                    ? { transportType: device.push.recipient.transportType }
                    : undefined,
                },
              },
              success: true,
              timestamp: new Date().toISOString(),
            },
            flags,
          ),
        );
      } else {
        this.log(chalk.bold("Device Details\n"));

        this.log(`${chalk.dim("Device ID:")}    ${chalk.green(device.id)}`);

        if (device.clientId) {
          this.log(`${chalk.dim("Client ID:")}    ${device.clientId}`);
        }

        this.log(`${chalk.dim("Platform:")}     ${device.platform}`);
        this.log(`${chalk.dim("Form Factor:")}  ${device.formFactor}`);

        if (device.push?.state) {
          const stateColor =
            device.push.state === "ACTIVE"
              ? chalk.green
              : device.push.state === "FAILING"
                ? chalk.yellow
                : chalk.red;
          this.log(
            `${chalk.dim("State:")}        ${stateColor(device.push.state)}`,
          );
        }

        if (device.push?.error) {
          this.log("");
          this.log(chalk.red("Last Error:"));
          this.log(`  ${chalk.dim("Message:")} ${device.push.error.message}`);
          if (device.push.error.code) {
            this.log(`  ${chalk.dim("Code:")} ${device.push.error.code}`);
          }
        }

        // Show recipient info (redacted)
        if (device.push?.recipient) {
          this.log("");
          this.log(chalk.dim("Push Recipient:"));
          this.log(
            `  ${chalk.dim("Transport:")}    ${device.push.recipient.transportType}`,
          );

          // Show redacted token for security
          const recipient = device.push.recipient as Record<string, unknown>;
          const token = recipient.registrationToken || recipient.deviceToken;

          if (typeof token === "string" && token.length > 8) {
            const redacted = `${token.slice(0, 4)}...${token.slice(-4)}`;
            this.log(`  ${chalk.dim("Token:")}        ${redacted} (redacted)`);
          }
        }

        if (device.metadata && Object.keys(device.metadata).length > 0) {
          this.log("");
          this.log(chalk.dim("Metadata:"));
          for (const [key, value] of Object.entries(device.metadata)) {
            this.log(`  ${chalk.dim(key + ":")} ${String(value)}`);
          }
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorCode = (error as { code?: number }).code;

      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          {
            error: errorMessage,
            code: errorCode,
            success: false,
          },
          flags,
        );
      } else {
        if (errorCode === 40400) {
          this.error(`Device not found: ${args.deviceId}`);
        } else {
          this.error(`Error getting device: ${errorMessage}`);
        }
      }
    }
  }
}
