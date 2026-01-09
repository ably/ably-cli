import { Args, Flags } from "@oclif/core";
import { AblyBaseCommand } from "../../../base-command.js";
import chalk from "chalk";
import { promptForConfirmation } from "../../../utils/prompt-confirmation.js";

export default class PushDevicesRemove extends AblyBaseCommand {
  static override description =
    "Remove a registered push notification device (maps to push.admin.deviceRegistrations.remove)";

  static override examples = [
    "$ ably push devices remove DEVICE_ID",
    "$ ably push devices remove my-device-123",
    "$ ably push devices remove my-device-123 --force",
    "$ ably push devices remove my-device-123 --json",
  ];

  static override args = {
    deviceId: Args.string({
      description: "The device ID to remove",
      required: true,
    }),
  };

  static override flags = {
    ...AblyBaseCommand.globalFlags,
    force: Flags.boolean({
      char: "f",
      default: false,
      description: "Skip confirmation prompt",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(PushDevicesRemove);

    try {
      const rest = await this.createAblyRestClient(flags);
      if (!rest) {
        return;
      }

      // Confirm deletion unless --force is used
      if (!flags.force && !this.shouldOutputJson(flags)) {
        const confirmed = await promptForConfirmation(
          `Are you sure you want to remove device ${chalk.cyan(args.deviceId)}?`,
        );

        if (!confirmed) {
          this.log("Operation cancelled.");
          return;
        }
      }

      // Remove the device
      await rest.push.admin.deviceRegistrations.remove(args.deviceId);

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              deviceId: args.deviceId,
              removed: true,
              success: true,
              timestamp: new Date().toISOString(),
            },
            flags,
          ),
        );
      } else {
        this.log(chalk.green(`Device removed successfully: ${args.deviceId}`));
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
          this.error(`Error removing device: ${errorMessage}`);
        }
      }
    }
  }
}
