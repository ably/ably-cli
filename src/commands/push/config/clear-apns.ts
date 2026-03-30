import { Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { forceFlag } from "../../../flags.js";
import {
  formatProgress,
  formatResource,
  formatSuccess,
  formatWarning,
} from "../../../utils/output.js";
import { promptForConfirmation } from "../../../utils/prompt-confirmation.js";

export default class PushConfigClearApns extends ControlBaseCommand {
  static override description =
    "Clear APNs push notification configuration for an app";

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
    ...forceFlag,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushConfigClearApns);

    await this.runControlCommand(
      flags,
      async (controlApi) => {
        const appId = await this.requireAppId(flags);

        if (!flags.force && !this.shouldOutputJson(flags)) {
          const confirmed = await promptForConfirmation(
            `Are you sure you want to clear APNs configuration for app ${formatResource(appId)}?`,
          );

          if (!confirmed) {
            this.log("Operation cancelled.");
            return;
          }
        }

        if (!this.shouldOutputJson(flags)) {
          this.log(
            formatProgress(
              `Checking APNs configuration for app ${formatResource(appId)}`,
            ),
          );
        }

        const app = await controlApi.getApp(appId);
        const apnsConfigured = !!(
          app.apnsCertificateConfigured || app.apnsSigningKeyConfigured
        );

        if (!apnsConfigured) {
          if (this.shouldOutputJson(flags)) {
            this.logJsonResult(
              { config: { appId, cleared: "apns", wasConfigured: false } },
              flags,
            );
          } else {
            this.log(
              formatWarning(
                `APNs is not configured for app ${formatResource(appId)}. Nothing to clear.`,
              ),
            );
          }
          return;
        }

        if (!this.shouldOutputJson(flags)) {
          this.log(
            formatProgress(
              `Clearing APNs configuration for app ${formatResource(appId)}`,
            ),
          );
        }

        await controlApi.updateApp(appId, {
          apnsAuthType: null,
          apnsCertificate: null,
          apnsIssuerKey: null,
          apnsPrivateKey: null,
          apnsSigningKey: null,
          apnsSigningKeyId: null,
          apnsTopicHeader: null,
          apnsUseSandboxEndpoint: null,
        });

        if (this.shouldOutputJson(flags)) {
          this.logJsonResult({ config: { appId, cleared: "apns" } }, flags);
        } else {
          this.log(
            formatSuccess(
              `APNs configuration cleared for app ${formatResource(appId)}.`,
            ),
          );
        }
      },
      "Error clearing APNs configuration",
    );
  }
}
