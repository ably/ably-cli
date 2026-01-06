import { Flags } from "@oclif/core";
import { AblyBaseCommand } from "../../../base-command.js";
import * as Ably from "ably";
import chalk from "chalk";

export default class PushDevicesRemoveWhere extends AblyBaseCommand {
  static override description =
    "Remove all devices matching specified criteria (maps to push.admin.deviceRegistrations.removeWhere)";

  static override examples = [
    "$ ably push devices remove-where --client-id user-123",
    "$ ably push devices remove-where --device-id device-prefix",
    "$ ably push devices remove-where --client-id user-123 --force",
  ];

  static override flags = {
    ...AblyBaseCommand.globalFlags,
    "client-id": Flags.string({
      description: "Remove all devices for this client ID",
    }),
    "device-id": Flags.string({
      description: "Remove device with this ID",
    }),
    force: Flags.boolean({
      char: "f",
      default: false,
      description: "Skip confirmation prompt",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushDevicesRemoveWhere);

    // Require at least one filter criterion
    if (!flags["client-id"] && !flags["device-id"]) {
      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              error:
                "At least one filter criterion is required: --client-id or --device-id",
              success: false,
            },
            flags,
          ),
        );
      } else {
        this.error(
          "At least one filter criterion is required: --client-id or --device-id",
        );
      }

      return;
    }

    try {
      const rest = await this.createAblyRestClient(flags);
      if (!rest) {
        return;
      }

      // Build filter params
      const params: Ably.DeviceRegistrationParams = {};

      if (flags["client-id"]) {
        params.clientId = flags["client-id"];
      }

      if (flags["device-id"]) {
        params.deviceId = flags["device-id"];
      }

      // Build description of what will be removed
      const filterDescription = this.buildFilterDescription(flags);

      // Confirm deletion unless --force is used
      if (!flags.force && !this.shouldOutputJson(flags)) {
        const { default: inquirer } = await import("inquirer");
        const { confirmed } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirmed",
            message: `Are you sure you want to remove all devices ${filterDescription}?`,
            default: false,
          },
        ]);

        if (!confirmed) {
          this.log("Operation cancelled.");
          return;
        }
      }

      // Remove matching devices
      await rest.push.admin.deviceRegistrations.removeWhere(params);

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              filter: {
                clientId: flags["client-id"],
                deviceId: flags["device-id"],
              },
              removed: true,
              success: true,
              timestamp: new Date().toISOString(),
            },
            flags,
          ),
        );
      } else {
        this.log(
          chalk.green(`Devices removed successfully ${filterDescription}`),
        );
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
        this.error(`Error removing devices: ${errorMessage}`);
      }
    }
  }

  private buildFilterDescription(flags: Record<string, unknown>): string {
    const parts: string[] = [];

    if (flags["client-id"]) {
      parts.push(`with client ID ${chalk.cyan(flags["client-id"] as string)}`);
    }

    if (flags["device-id"]) {
      parts.push(`with device ID ${chalk.cyan(flags["device-id"] as string)}`);
    }

    return parts.join(" and ");
  }
}
