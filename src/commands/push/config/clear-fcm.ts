import { Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { forceFlag } from "../../../flags.js";
import { formatResource } from "../../../utils/output.js";
import { promptForConfirmation } from "../../../utils/prompt-confirmation.js";

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
    ...forceFlag,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushConfigClearFcm);

    await this.runControlCommand(
      flags,
      async (controlApi) => {
        const appId = await this.requireAppId(flags);

        // In JSON mode, require --force to prevent accidental destructive actions
        if (!flags.force && this.shouldOutputJson(flags)) {
          this.fail(
            "The --force flag is required when using --json to confirm clearing FCM configuration",
            flags,
            "pushConfigClearFcm",
          );
        }

        if (!flags.force && !this.shouldOutputJson(flags)) {
          const confirmed = await promptForConfirmation(
            `Are you sure you want to clear FCM configuration for app ${formatResource(appId)}?`,
          );

          if (!confirmed) {
            this.logWarning("Operation cancelled.", flags);
            return;
          }
        }

        this.logProgress(
          `Checking FCM configuration for app ${formatResource(appId)}`,
          flags,
        );

        const app = await controlApi.getApp(appId);
        const fcmConfigured = !!app.fcmServiceAccountConfigured;

        if (!fcmConfigured) {
          if (this.shouldOutputJson(flags)) {
            this.logJsonResult(
              { config: { appId, cleared: "fcm", wasConfigured: false } },
              flags,
            );
          }

          this.logWarning(
            `FCM is not configured for app ${formatResource(appId)}. Nothing to clear.`,
            flags,
          );
          return;
        }

        this.logProgress(
          `Clearing FCM configuration for app ${formatResource(appId)}`,
          flags,
        );

        await controlApi.updateApp(appId, {
          fcmProjectId: null,
          fcmServiceAccount: null,
        });

        if (this.shouldOutputJson(flags)) {
          this.logJsonResult({ config: { appId, cleared: "fcm" } }, flags);
        } else {
          this.logSuccessMessage(
            `FCM configuration cleared for app ${formatResource(appId)}.`,
            flags,
          );
        }
      },
      "Error clearing FCM configuration",
    );
  }
}
