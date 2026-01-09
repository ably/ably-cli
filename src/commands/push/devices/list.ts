import { Flags } from "@oclif/core";
import { AblyBaseCommand } from "../../../base-command.js";
import * as Ably from "ably";
import chalk from "chalk";

export default class PushDevicesList extends AblyBaseCommand {
  static override description =
    "List registered push notification devices (maps to push.admin.deviceRegistrations.list)";

  static override examples = [
    "$ ably push devices list",
    "$ ably push devices list --recipient-client-id user-123",
    "$ ably push devices list --device-id device-456",
    "$ ably push devices list --state ACTIVE",
    "$ ably push devices list --limit 50",
    "$ ably push devices list --json",
  ];

  static override flags = {
    ...AblyBaseCommand.globalFlags,
    "recipient-client-id": Flags.string({
      description: "Filter devices by client ID",
    }),
    "device-id": Flags.string({
      description: "Filter by device ID",
    }),
    state: Flags.string({
      description: "Filter by device state",
      options: ["ACTIVE", "FAILING", "FAILED"],
    }),
    limit: Flags.integer({
      default: 100,
      description: "Maximum number of devices to return (max: 1000)",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushDevicesList);

    try {
      const rest = await this.createAblyRestClient(flags);
      if (!rest) {
        return;
      }

      // Build filter params
      const params: Ably.DeviceRegistrationParams = {};

      if (flags["recipient-client-id"]) {
        params.clientId = flags["recipient-client-id"];
      }

      if (flags["device-id"]) {
        params.deviceId = flags["device-id"];
      }

      if (flags.state) {
        params.state = flags.state as Ably.DevicePushState;
      }

      if (flags.limit) {
        params.limit = Math.min(flags.limit, 1000);
      }

      // Fetch devices
      const devicesPage =
        await rest.push.admin.deviceRegistrations.list(params);
      const devices = devicesPage.items;

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              devices: devices.map((device) => ({
                id: device.id,
                platform: device.platform,
                formFactor: device.formFactor,
                clientId: device.clientId,
                state: device.push?.state,
                metadata: device.metadata,
              })),
              hasMore: devicesPage.hasNext(),
              success: true,
              timestamp: new Date().toISOString(),
              total: devices.length,
            },
            flags,
          ),
        );
      } else {
        if (devices.length === 0) {
          this.log("No devices found.");
          return;
        }

        this.log(
          `Found ${chalk.cyan(devices.length.toString())} device${devices.length === 1 ? "" : "s"}:\n`,
        );

        for (const device of devices) {
          this.log(`${chalk.green(device.id)}`);
          this.log(`  ${chalk.dim("Platform:")} ${device.platform}`);
          this.log(`  ${chalk.dim("Form Factor:")} ${device.formFactor}`);

          if (device.clientId) {
            this.log(`  ${chalk.dim("Client ID:")} ${device.clientId}`);
          }

          if (device.push?.state) {
            const stateColor =
              device.push.state === "ACTIVE"
                ? chalk.green
                : device.push.state === "FAILING"
                  ? chalk.yellow
                  : chalk.red;
            this.log(
              `  ${chalk.dim("State:")} ${stateColor(device.push.state)}`,
            );
          }

          this.log(""); // Add spacing between devices
        }

        if (devicesPage.hasNext()) {
          this.log(
            chalk.yellow(
              `Showing first ${devices.length} devices. Use --limit to show more.`,
            ),
          );
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          {
            error: errorMessage,
            success: false,
          },
          flags,
        );
      } else {
        this.error(`Error listing devices: ${errorMessage}`);
      }
    }
  }
}
