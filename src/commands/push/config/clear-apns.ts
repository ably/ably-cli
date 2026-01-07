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
        // Check both new Control API field (apnsAuthType) and legacy field (apnsUsesSandboxCert)
        // For apps configured before the Control API update, apnsAuthType may not be set
        // while apnsUsesSandboxCert is defined
        const app = await api.getApp(appId);
        const hasApnsConfig =
          (app.apnsAuthType !== null && app.apnsAuthType !== undefined) ||
          (app.apnsUsesSandboxCert !== null &&
            app.apnsUsesSandboxCert !== undefined);

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

        // Confirm unless --force is used or in JSON mode (JSON mode should not prompt)
        if (!flags.force && !this.shouldOutputJson(flags)) {
          const confirmed = await this.interactiveHelper.confirm(
            `Are you sure you want to remove APNs configuration from app "${app.name}"?`,
          );
          if (!confirmed) {
            this.log("Operation cancelled.");
            return;
          }
        }

        if (!this.shouldOutputJson(flags)) {
          this.log(`Clearing APNs configuration for app ${appId}...`);
        }

        // Clear APNs configuration by setting fields to null/empty
        // Include both certificate-based and token-based auth fields
        // New field names (per Control API updates):
        // - apnsAuthType, apnsSigningKey, apnsSigningKeyId, apnsIssuerKey, apnsTopicHeader
        // Legacy field names (for backwards compatibility):
        // - apnsCertificate, apnsPrivateKey
        await api.updateApp(appId, {
          // Token-based auth fields (new API)
          apnsAuthType: null,
          apnsSigningKey: null,
          apnsSigningKeyId: null,
          apnsIssuerKey: null,
          apnsTopicHeader: null,
          // Certificate-based auth fields
          apnsCertificate: null,
          apnsPrivateKey: null,
          // Common fields
          apnsUseSandboxEndpoint: null,
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
