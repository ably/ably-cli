import { Args, Flags } from "@oclif/core";
import inquirer from "inquirer";

import { AblyBaseCommand } from "../../../base-command.js";
import { productApiFlags } from "../../../flags.js";
import { BaseFlags } from "../../../types/cli.js";
import {
  formatProgress,
  formatResource,
  formatSuccess,
} from "../../../utils/output.js";

export default class PushDevicesRemove extends AblyBaseCommand {
  static override args = {
    "device-id": Args.string({
      description: "The device ID to remove",
      required: true,
    }),
  };

  static override description = "Remove a push device registration";

  static override examples = [
    "<%= config.bin %> <%= command.id %> device-123",
    "<%= config.bin %> <%= command.id %> device-123 --force",
    "<%= config.bin %> <%= command.id %> device-123 --json",
  ];

  static override flags = {
    ...productApiFlags,
    force: Flags.boolean({
      char: "f",
      default: false,
      description: "Skip confirmation prompt",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(PushDevicesRemove);
    const deviceId = args["device-id"];

    try {
      const rest = await this.createAblyRestClient(flags as BaseFlags);
      if (!rest) return;

      if (!flags.force && !this.shouldOutputJson(flags)) {
        const { confirmed } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirmed",
            message: `Are you sure you want to remove device ${deviceId}?`,
            default: false,
          },
        ]);

        if (!confirmed) {
          this.log("Operation cancelled.");
          return;
        }
      }

      if (!this.shouldOutputJson(flags)) {
        this.log(formatProgress(`Removing device ${formatResource(deviceId)}`));
      }

      await rest.push.admin.deviceRegistrations.remove(deviceId);

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult({ deviceId, removed: true }, flags);
      } else {
        this.log(formatSuccess(`Device ${formatResource(deviceId)} removed.`));
      }
    } catch (error) {
      this.fail(error, flags as BaseFlags, "pushDeviceRemove");
    }
  }
}
