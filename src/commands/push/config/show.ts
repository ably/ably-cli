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
          // Extract push-related fields using new Control API response fields
          // - apnsAuthType: 'token', 'certificate', or null (if not configured)
          // - fcmProjectId: project ID or null (if not configured)
          // - apnsUseSandboxEndpoint: boolean or null
          const pushConfig = {
            appId: app.id,
            appName: app.name,
            apns: {
              configured:
                app.apnsAuthType !== null && app.apnsAuthType !== undefined,
              authType: app.apnsAuthType || null,
              useSandbox:
                app.apnsUseSandboxEndpoint ?? app.apnsUsesSandboxCert ?? false,
            },
            fcm: {
              configured:
                app.fcmProjectId !== null && app.fcmProjectId !== undefined,
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
          // Use new Control API response field: apnsAuthType ('token', 'certificate', or null)
          this.log(chalk.cyan("APNs (iOS):"));
          const apnsConfigured =
            app.apnsAuthType !== null && app.apnsAuthType !== undefined;

          if (apnsConfigured) {
            this.log(
              `  ${chalk.dim("Status:")}      ${chalk.green("Configured")}`,
            );
            // Use apnsUseSandboxEndpoint (new) or fallback to apnsUsesSandboxCert (legacy)
            const useSandbox =
              app.apnsUseSandboxEndpoint ?? app.apnsUsesSandboxCert ?? false;
            const environment = useSandbox ? "Sandbox" : "Production";
            this.log(`  ${chalk.dim("Environment:")} ${environment}`);

            // Use apnsAuthType to determine auth type
            if (app.apnsAuthType === "token") {
              this.log(`  ${chalk.dim("Auth Type:")}   Token-based (.p8)`);
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
          // Use new Control API response field: fcmProjectId (string or null)
          this.log(chalk.cyan("FCM (Android):"));
          const fcmConfigured =
            app.fcmProjectId !== null && app.fcmProjectId !== undefined;

          if (fcmConfigured) {
            this.log(
              `  ${chalk.dim("Status:")}      ${chalk.green("Configured")}`,
            );
            this.log(`  ${chalk.dim("Project ID:")}  ${app.fcmProjectId}`);
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
