import { Flags } from "@oclif/core";

import { AblyBaseCommand } from "../../../base-command.js";
import { forceFlag, productApiFlags } from "../../../flags.js";
import { promptForConfirmation } from "../../../utils/prompt-confirmation.js";

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
    ...forceFlag,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushDevicesRemoveWhere);

    if (!flags["device-id"] && !flags["client-id"]) {
      this.fail(
        "At least one filter is required: --device-id or --client-id",
        flags,
        "pushDeviceRemoveWhere",
      );
    }

    try {
      const rest = await this.createAblyRestClient(flags);
      if (!rest) return;

      const params: Record<string, string> = {};
      if (flags["device-id"]) params.deviceId = flags["device-id"];
      if (flags["client-id"]) params.clientId = flags["client-id"];

      // In JSON mode, require --force to prevent accidental destructive actions
      if (!flags.force && this.shouldOutputJson(flags)) {
        this.fail(
          "The --force flag is required when using --json to confirm removal",
          flags,
          "pushDeviceRemoveWhere",
        );
      }

      if (!flags.force && !this.shouldOutputJson(flags)) {
        const filterDesc = Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ");

        const confirmed = await promptForConfirmation(
          `Are you sure you want to remove all devices matching: ${filterDesc}?`,
        );

        if (!confirmed) {
          this.logWarning("Operation cancelled.", flags);
          return;
        }
      }

      this.logProgress("Removing matching device registrations", flags);

      await rest.push.admin.deviceRegistrations.removeWhere(params);

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          { devices: { removed: true, filters: params } },
          flags,
        );
      } else {
        this.logSuccessMessage("Matching device registrations removed.", flags);
      }
    } catch (error) {
      this.fail(error, flags, "pushDeviceRemoveWhere");
    }
  }
}
