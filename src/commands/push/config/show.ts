import { Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
import {
  formatLabel,
  formatProgress,
  formatResource,
  formatSuccess,
} from "../../../utils/output.js";

export default class PushConfigShow extends ControlBaseCommand {
  static override description =
    "Show push notification configuration for an app";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --app my-app",
    "<%= config.bin %> <%= command.id %> --json",
  ];

  static override flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "The app ID or name (defaults to current app)",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushConfigShow);

    await this.runControlCommand(
      flags,
      async (controlApi) => {
        const appId = await this.requireAppId(flags);

        if (!this.shouldOutputJson(flags)) {
          this.log(
            formatProgress(
              `Fetching push configuration for app ${formatResource(appId)}`,
            ),
          );
        }

        const app = await controlApi.getApp(appId);

        const apnsConfigured = !!(
          app.apnsCertificateConfigured || app.apnsSigningKeyConfigured
        );
        const fcmConfigured = !!app.fcmServiceAccountConfigured;

        const config = {
          appId,
          apns: {
            configured: apnsConfigured,
            useSandbox:
              app.apnsUseSandboxEndpoint ?? app.apnsUsesSandboxCert ?? false,
            ...(app.apnsTopicHeader ? { bundleId: app.apnsTopicHeader } : {}),
            ...(app.apnsIssuerKey ? { teamId: app.apnsIssuerKey } : {}),
            ...(app.apnsSigningKeyId ? { keyId: app.apnsSigningKeyId } : {}),
            ...(app.apnsAuthType ? { authType: app.apnsAuthType } : {}),
            hasP12Certificate: !!app.apnsCertificateConfigured,
            hasP8Key: !!app.apnsSigningKeyConfigured,
          },
          fcm: {
            configured: fcmConfigured,
            ...(app.fcmProjectId ? { projectId: app.fcmProjectId } : {}),
          },
          web: {
            available: !!(apnsConfigured || fcmConfigured),
          },
        };

        if (this.shouldOutputJson(flags)) {
          this.logJsonResult(config, flags);
          return;
        }

        this.log(
          formatSuccess(`Push configuration for app ${formatResource(appId)}.`),
        );
        this.log("");

        this.log("APNs Configuration:");
        this.log(
          `  ${formatLabel("Status")} ${apnsConfigured ? "Configured" : "Not configured"}`,
        );
        if (apnsConfigured) {
          this.log(
            `  ${formatLabel("Environment")} ${config.apns.useSandbox ? "Sandbox" : "Production"}`,
          );
          if (config.apns.hasP12Certificate) {
            this.log(`  ${formatLabel("Auth Method")} P12 Certificate`);
          }
          if (config.apns.hasP8Key) {
            this.log(`  ${formatLabel("Auth Method")} P8 Key`);
            if (config.apns.teamId)
              this.log(
                `  ${formatLabel("Team ID")} ${config.apns.teamId as string}`,
              );
            if (config.apns.keyId)
              this.log(
                `  ${formatLabel("Key ID")} ${config.apns.keyId as string}`,
              );
            if (config.apns.bundleId)
              this.log(
                `  ${formatLabel("Bundle ID")} ${config.apns.bundleId as string}`,
              );
          }
        }
        this.log("");
        this.log("FCM Configuration:");
        this.log(
          `  ${formatLabel("Status")} ${fcmConfigured ? "Configured" : "Not configured"}`,
        );
        if (config.fcm.projectId) {
          this.log(
            `  ${formatLabel("Project ID")} ${config.fcm.projectId as string}`,
          );
        }
        this.log("");
        this.log("Web Push:");
        this.log(
          `  ${formatLabel("Status")} ${config.web.available ? "Available" : "Not available"}`,
        );
        if (!config.web.available) {
          this.log(`  Configure APNs or FCM to enable web push notifications.`);
        }
      },
      "Error fetching push configuration",
    );
  }
}
