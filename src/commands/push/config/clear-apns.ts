import { Flags } from "@oclif/core";
import chalk from "chalk";

import { ControlBaseCommand } from "../../../control-base-command.js";

export default class PushConfigClearApns extends ControlBaseCommand {
  static override description =
    "Remove APNs (Apple Push Notification service) configuration from an app";

  static override examples = [
    "$ ably push config clear-apns",
    "$ ably push config clear-apns --app my-app",
    "$ ably push config clear-apns --force",
  ];

  static override flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "App ID or name to clear APNs configuration for",
    }),
    force: Flags.boolean({
      char: "f",
      default: false,
      description: "Skip confirmation prompt",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushConfigClearApns);

    await this.runControlCommand(
      flags,
      async (api) => {
        const appId = await this.resolveAppId(flags);

        // Get current app to show what will be cleared
        const app = await api.getApp(appId);
        const hasApnsConfig = Boolean(
          app.apnsCertificate || app.apnsPrivateKey || app.applePushKeyId,
        );

        if (!hasApnsConfig) {
          if (this.shouldOutputJson(flags)) {
            this.log(
              this.formatJsonOutput(
                {
                  success: true,
                  appId,
                  message: "No APNs configuration to clear",
                },
                flags,
              ),
            );
          } else {
            this.log(
              chalk.yellow(
                `No APNs configuration found for app "${app.name}" (${appId})`,
              ),
            );
          }
          return;
        }

        // Confirm unless --force is used
        if (!flags.force) {
          const confirmed = await this.interactiveHelper.confirm(
            `Are you sure you want to remove APNs configuration from app "${app.name}"?`,
          );
          if (!confirmed) {
            this.log("Operation cancelled.");
            return;
          }
        }

        this.log(`Clearing APNs configuration for app ${appId}...`);

        // Clear APNs configuration by setting fields to null/empty
        await api.updateApp(appId, {
          apnsCertificate: null,
          apnsPrivateKey: null,
          applePushKeyId: null,
          applePushTeamId: null,
          applePushBundleId: null,
          apnsUsesSandboxCert: false,
        } as Record<string, unknown>);

        if (this.shouldOutputJson(flags)) {
          this.log(
            this.formatJsonOutput(
              {
                success: true,
                appId,
                appName: app.name,
                message: "APNs configuration cleared",
              },
              flags,
            ),
          );
        } else {
          this.log(
            chalk.green(
              `\nAPNs configuration cleared successfully for app "${app.name}"`,
            ),
          );
        }
      },
      "Error clearing APNs configuration",
    );
  }
}
