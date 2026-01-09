import { Flags } from "@oclif/core";
import { AblyBaseCommand } from "../../../base-command.js";
import * as Ably from "ably";
import chalk from "chalk";
import { promptForConfirmation } from "../../../utils/prompt-confirmation.js";

export default class PushDevicesRemoveWhere extends AblyBaseCommand {
  static override description =
    "Remove all devices matching specified criteria (maps to push.admin.deviceRegistrations.removeWhere)";

  static override examples = [
    "$ ably push devices remove-where --recipient-client-id user-123",
    "$ ably push devices remove-where --device-id device-prefix",
    "$ ably push devices remove-where --recipient-client-id user-123 --force",
  ];

  static override flags = {
    ...AblyBaseCommand.globalFlags,
    "recipient-client-id": Flags.string({
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
    if (!flags["recipient-client-id"] && !flags["device-id"]) {
      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          {
            error:
              "At least one filter criterion is required: --recipient-client-id or --device-id",
            success: false,
          },
          flags,
        );
      } else {
        this.error(
          "At least one filter criterion is required: --recipient-client-id or --device-id",
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

      if (flags["recipient-client-id"]) {
        params.clientId = flags["recipient-client-id"];
      }

      if (flags["device-id"]) {
        params.deviceId = flags["device-id"];
      }

      // Build description of what will be removed
      const filterDescription = this.buildFilterDescription(flags);

      // Confirm deletion unless --force is used
      if (!flags.force && !this.shouldOutputJson(flags)) {
        const confirmed = await promptForConfirmation(
          `Are you sure you want to remove all devices ${filterDescription}?`,
        );

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
                clientId: flags["recipient-client-id"],
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
        this.jsonError(
          {
            error: errorMessage,
            code: errorCode,
            success: false,
          },
          flags,
        );
      } else {
        this.error(`Error removing devices: ${errorMessage}`);
      }
    }
  }

  private buildFilterDescription(flags: Record<string, unknown>): string {
    const parts: string[] = [];

    if (flags["recipient-client-id"]) {
      parts.push(
        `with client ID ${chalk.cyan(flags["recipient-client-id"] as string)}`,
      );
    }

    if (flags["device-id"]) {
      parts.push(`with device ID ${chalk.cyan(flags["device-id"] as string)}`);
    }

    return parts.join(" and ");
  }
}
