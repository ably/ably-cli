import { Args } from "@oclif/core";

import { AblyBaseCommand } from "../../../base-command.js";
import { forceFlag, productApiFlags } from "../../../flags.js";
import { BaseFlags } from "../../../types/cli.js";
import { formatResource } from "../../../utils/output.js";
import { promptForConfirmation } from "../../../utils/prompt-confirmation.js";

export default class PushDevicesRemove extends AblyBaseCommand {
  static override args = {
    deviceId: Args.string({
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
    ...forceFlag,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(PushDevicesRemove);
    const deviceId = args.deviceId;

    try {
      const rest = await this.createAblyRestClient(flags as BaseFlags);
      if (!rest) return;

      // In JSON mode, require --force to prevent accidental destructive actions
      if (!flags.force && this.shouldOutputJson(flags)) {
        this.fail(
          "The --force flag is required when using --json to confirm removal",
          flags,
          "pushDeviceRemove",
        );
      }

      if (!flags.force && !this.shouldOutputJson(flags)) {
        const confirmed = await promptForConfirmation(
          `Are you sure you want to remove device ${deviceId}?`,
        );

        if (!confirmed) {
          this.logWarning("Operation cancelled.", flags);
          return;
        }
      }

      this.logProgress(`Removing device ${formatResource(deviceId)}`, flags);

      await rest.push.admin.deviceRegistrations.remove(deviceId);

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult({ device: { id: deviceId, removed: true } }, flags);
      } else {
        this.logSuccessMessage(
          `Device ${formatResource(deviceId)} removed.`,
          flags,
        );
      }
    } catch (error) {
      this.fail(error, flags as BaseFlags, "pushDeviceRemove");
    }
  }
}
