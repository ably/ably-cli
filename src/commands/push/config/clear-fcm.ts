import { Flags } from "@oclif/core";
import chalk from "chalk";

import { ControlBaseCommand } from "../../../control-base-command.js";

export default class PushConfigClearFcm extends ControlBaseCommand {
  static override description =
    "Remove Firebase Cloud Messaging (FCM) configuration from an app.";

  static override examples = [
    "$ ably push config clear-fcm",
    "$ ably push config clear-fcm --app my-app",
    "$ ably push config clear-fcm --force",
  ];

  static override flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "App ID or name to clear FCM configuration for",
    }),
    force: Flags.boolean({
      char: "f",
      description: "Skip confirmation prompt",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushConfigClearFcm);

    await this.runControlCommand(
      flags,
      async (api) => {
        const appId = await this.resolveAppId(flags);

        // Get current app to check if FCM is configured
        const app = await api.getApp(appId);

        if (!app.fcmServiceAccount && !app.fcmProjectId) {
          this.log(chalk.yellow("FCM is not configured for this app."));
          return;
        }

        // Confirm unless --force
        if (!flags.force) {
          const confirmed = await this.confirm(
            `Are you sure you want to remove FCM configuration from app "${app.name}" (${appId})? ` +
              `This will disable push notifications for Android devices.`,
          );
          if (!confirmed) {
            this.log("Operation cancelled.");
            return;
          }
        }

        if (!this.shouldOutputJson(flags)) {
          this.log(`Removing FCM configuration from app ${appId}...`);
        }

        // Clear FCM configuration by setting field to null
        await api.updateApp(appId, {
          fcmServiceAccount: null,
        } as Record<string, unknown>);

        if (this.shouldOutputJson(flags)) {
          this.log(
            this.formatJsonOutput(
              {
                success: true,
                appId,
                message: "FCM configuration cleared",
              },
              flags,
            ),
          );
        } else {
          this.log(chalk.green("\nFCM configuration removed successfully!"));
          this.log(
            chalk.dim(
              "Push notifications to Android devices will no longer work until FCM is reconfigured.",
            ),
          );
        }
      },
      "Error clearing FCM configuration",
    );
  }

  private async confirm(message: string): Promise<boolean> {
    // Use readline for confirmation
    const readline = await import("node:readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(`${message} (y/N) `, (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
      });
    });
  }
}
