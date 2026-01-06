import { Flags } from "@oclif/core";
import chalk from "chalk";

import { ControlBaseCommand } from "../../../control-base-command.js";

export default class PushConfigShow extends ControlBaseCommand {
  static override description =
    "Show push notification configuration status for an app";

  static override examples = [
    "$ ably push config show",
    "$ ably push config show --app my-app",
    "$ ably push config show --json",
  ];

  static override flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "App ID or name to show configuration for",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushConfigShow);

    await this.runControlCommand(
      flags,
      async (api) => {
        // Resolve app ID
        const appId = await this.resolveAppId(flags);

        // Get app details
        const app = await api.getApp(appId);

        if (this.shouldOutputJson(flags)) {
          // Extract push-related fields
          const pushConfig = {
            appId: app.id,
            appName: app.name,
            apns: {
              configured: Boolean(
                app.apnsCertificate || app.apnsPrivateKey || app.applePushKeyId,
              ),
              useSandbox: app.apnsUsesSandboxCert || false,
              // Token-based auth fields
              keyId: app.applePushKeyId || null,
              teamId: app.applePushTeamId || null,
              bundleId: app.applePushBundleId || null,
            },
            fcm: {
              configured: Boolean(app.fcmServiceAccount || app.fcmProjectId),
              projectId: app.fcmProjectId || null,
            },
          };
          this.log(this.formatJsonOutput(pushConfig, flags));
        } else {
          this.log(
            chalk.bold(
              `Push Notification Configuration for app "${app.name}" (${app.id})\n`,
            ),
          );

          // APNs Configuration
          this.log(chalk.cyan("APNs (iOS):"));
          const apnsConfigured = Boolean(
            app.apnsCertificate || app.apnsPrivateKey || app.applePushKeyId,
          );

          if (apnsConfigured) {
            this.log(
              `  ${chalk.dim("Status:")}      ${chalk.green("Configured")}`,
            );
            const environment = app.apnsUsesSandboxCert
              ? "Sandbox"
              : "Production";
            this.log(`  ${chalk.dim("Environment:")} ${environment}`);

            // Check if using token-based or certificate-based auth
            if (app.applePushKeyId) {
              this.log(`  ${chalk.dim("Auth Type:")}   Token-based (.p8)`);
              this.log(`  ${chalk.dim("Key ID:")}      ${app.applePushKeyId}`);
              if (app.applePushTeamId) {
                this.log(
                  `  ${chalk.dim("Team ID:")}     ${app.applePushTeamId}`,
                );
              }
              if (app.applePushBundleId) {
                this.log(
                  `  ${chalk.dim("Bundle ID:")}   ${app.applePushBundleId}`,
                );
              }
            } else {
              this.log(
                `  ${chalk.dim("Auth Type:")}   Certificate-based (.p12)`,
              );
            }
          } else {
            this.log(
              `  ${chalk.dim("Status:")}      ${chalk.yellow("Not configured")}`,
            );
          }

          this.log("");

          // FCM Configuration
          this.log(chalk.cyan("FCM (Android):"));
          const fcmConfigured = Boolean(
            app.fcmServiceAccount || app.fcmProjectId,
          );

          if (fcmConfigured) {
            this.log(
              `  ${chalk.dim("Status:")}      ${chalk.green("Configured")}`,
            );
            if (app.fcmProjectId) {
              this.log(`  ${chalk.dim("Project ID:")}  ${app.fcmProjectId}`);
            }
          } else {
            this.log(
              `  ${chalk.dim("Status:")}      ${chalk.yellow("Not configured")}`,
            );
          }

          // Web Push info
          this.log("");
          this.log(chalk.cyan("Web Push:"));
          this.log(
            `  ${chalk.dim("Status:")}      ${chalk.green("Available")} (no configuration required)`,
          );
        }

        return app;
      },
      "Error retrieving push configuration",
    );
  }
}
