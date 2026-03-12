import { Flags } from "@oclif/core";
import inquirer from "inquirer";

import { AblyBaseCommand } from "../../../base-command.js";
import { productApiFlags } from "../../../flags.js";
import { BaseFlags } from "../../../types/cli.js";
import { formatProgress, formatSuccess } from "../../../utils/output.js";

export default class PushDevicesRemoveWhere extends AblyBaseCommand {
  static override description =
    "Remove push device registrations matching filter criteria";

  static override examples = [
    "<%= config.bin %> <%= command.id %> --device-id device-123",
    "<%= config.bin %> <%= command.id %> --client-id client-1 --force",
    "<%= config.bin %> <%= command.id %> --device-id device-123 --json",
  ];

  static override flags = {
    ...productApiFlags,
    "device-id": Flags.string({
      description: "Filter by device ID",
    }),
    "client-id": Flags.string({
      description: "Filter by client ID",
    }),
    force: Flags.boolean({
      char: "f",
      default: false,
      description: "Skip confirmation prompt",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushDevicesRemoveWhere);

    if (!flags["device-id"] && !flags["client-id"]) {
      this.fail(
        "At least one filter is required: --device-id or --client-id",
        flags as BaseFlags,
        "pushDeviceRemoveWhere",
      );
    }

    try {
      const rest = await this.createAblyRestClient(flags as BaseFlags);
      if (!rest) return;

      const params: Record<string, string> = {};
      if (flags["device-id"]) params.deviceId = flags["device-id"];
      if (flags["client-id"]) params.clientId = flags["client-id"];

      if (!flags.force && !this.shouldOutputJson(flags)) {
        const filterDesc = Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ");

        const { confirmed } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirmed",
            message: `Are you sure you want to remove all devices matching: ${filterDesc}?`,
            default: false,
          },
        ]);

        if (!confirmed) {
          this.log("Operation cancelled.");
          return;
        }
      }

      if (!this.shouldOutputJson(flags)) {
        this.log(formatProgress("Removing matching device registrations"));
      }

      await rest.push.admin.deviceRegistrations.removeWhere(params);

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult({ removed: true, filters: params }, flags);
      } else {
        this.log(formatSuccess("Matching device registrations removed."));
      }
    } catch (error) {
      this.fail(error, flags as BaseFlags, "pushDeviceRemoveWhere");
    }
  }
}
