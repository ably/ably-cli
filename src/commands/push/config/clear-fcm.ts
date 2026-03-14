import { Flags } from "@oclif/core";
import inquirer from "inquirer";

import { ControlBaseCommand } from "../../../control-base-command.js";
import {
  formatProgress,
  formatResource,
  formatSuccess,
  formatWarning,
} from "../../../utils/output.js";

export default class PushConfigClearFcm extends ControlBaseCommand {
  static override description =
    "Clear FCM push notification configuration for an app";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --app my-app --force",
    "<%= config.bin %> <%= command.id %> --force --json",
  ];

  static override flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "The app ID or name (defaults to current app)",
    }),
    force: Flags.boolean({
      char: "f",
      default: false,
      description: "Skip confirmation prompt",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushConfigClearFcm);

    await this.runControlCommand(
      flags,
      async (controlApi) => {
        const appId = await this.requireAppId(flags);

        if (!flags.force && !this.shouldOutputJson(flags)) {
          const { confirmed } = await inquirer.prompt([
            {
              default: false,
              message: `Are you sure you want to clear FCM configuration for app ${formatResource(appId)}?`,
              name: "confirmed",
              type: "confirm",
            },
          ]);

          if (!confirmed) {
            this.log("Operation cancelled.");
            return;
          }
        }

        if (!this.shouldOutputJson(flags)) {
          this.log(
            formatProgress(
              `Checking FCM configuration for app ${formatResource(appId)}`,
            ),
          );
        }

        const app = await controlApi.getApp(appId);
        const fcmConfigured = !!app.fcmServiceAccount;

        if (!fcmConfigured) {
          if (this.shouldOutputJson(flags)) {
            this.logJsonResult(
              { appId, cleared: "fcm", wasConfigured: false },
              flags,
            );
          } else {
            this.log(
              formatWarning(
                `FCM is not configured for app ${formatResource(appId)}. Nothing to clear.`,
              ),
            );
          }
          return;
        }

        if (!this.shouldOutputJson(flags)) {
          this.log(
            formatProgress(
              `Clearing FCM configuration for app ${formatResource(appId)}`,
            ),
          );
        }

        await controlApi.updateApp(appId, {
          fcmServiceAccount: null,
        });

        if (this.shouldOutputJson(flags)) {
          this.logJsonResult({ appId, cleared: "fcm" }, flags);
        } else {
          this.log(
            formatSuccess(
              `FCM configuration cleared for app ${formatResource(appId)}.`,
            ),
          );
        }
      },
      "Error clearing FCM configuration",
    );
  }
}
