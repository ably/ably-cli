import { Args, Flags } from "@oclif/core";
import * as readline from "node:readline";

import { ControlBaseCommand } from "../../control-base-command.js";
import { forceFlag } from "../../flags.js";
import { formatLabel, formatResource } from "../../utils/output.js";
import { promptForConfirmation } from "../../utils/prompt-confirmation.js";
import AppsSwitch from "./switch.js";

export default class AppsDeleteCommand extends ControlBaseCommand {
  static args = {
    appId: Args.string({
      description: "App ID to delete (uses current app if not specified)",
      required: false,
    }),
  };

  static description = "Delete an app";

  static examples = [
    "$ ably apps delete",
    "$ ably apps delete app-id",
    "$ ably apps delete --app app-id",
    '$ ABLY_ACCESS_TOKEN="YOUR_ACCESS_TOKEN" ably apps delete app-id',
    "$ ably apps delete app-id --force",
    "$ ably apps delete app-id --json",
    "$ ably apps delete app-id --pretty-json",
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,
    ...forceFlag,
    app: Flags.string({
      description: "The app ID or name (defaults to current app)",
      env: "ABLY_APP_ID",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(AppsDeleteCommand);

    // Use app ID from flag, argument, or current app (in that order)
    let appIdToDelete = flags.app || args.appId;
    if (!appIdToDelete) {
      appIdToDelete = this.configManager.getCurrentAppId();
      if (!appIdToDelete) {
        this.fail(
          'No app ID provided and no current app selected. Please provide an app ID or select a default app with "ably apps switch".',
          flags,
          "appDelete",
        );
      }
    }

    // Check if we're deleting the current app
    const isDeletingCurrentApp =
      appIdToDelete === this.configManager.getCurrentAppId();

    try {
      const controlApi = this.createControlApi(flags);
      // Get app details
      const app = await controlApi.getApp(appIdToDelete);

      // In JSON mode, require --force to prevent accidental destructive actions
      if (!flags.force && this.shouldOutputJson(flags)) {
        this.fail(
          "The --force flag is required when using --json to confirm deletion",
          flags,
          "appDelete",
        );
      }

      // If not using force flag, prompt for confirmation
      if (!flags.force && !this.shouldOutputJson(flags)) {
        this.log(`\nYou are about to delete the following app:`);
        this.log(`${formatLabel("App ID")} ${app.id}`);
        this.log(`${formatLabel("Name")} ${app.name}`);
        this.log(`${formatLabel("Status")} ${app.status}`);
        this.log(`${formatLabel("Account ID")} ${app.accountId}`);
        this.log(`${formatLabel("Created")} ${this.formatDate(app.created)}`);

        // For additional confirmation, prompt user to enter the app name
        const nameConfirmed = await this.promptForAppName(app.name);
        if (!nameConfirmed) {
          // This branch is only reachable when !shouldOutputJson (see outer condition),
          // so only human-readable output is needed here.
          this.logWarning(
            "Deletion cancelled - app name did not match.",
            flags,
          );
          return;
        }

        const confirmed = await promptForConfirmation(
          `\nAre you sure you want to delete app "${app.name}" (${app.id})? This action cannot be undone.`,
        );

        if (!confirmed) {
          // This branch is only reachable when !shouldOutputJson (see outer condition),
          // so only human-readable output is needed here.
          this.logWarning("Deletion cancelled.", flags);
          return;
        }
      }

      this.logProgress(`Deleting app ${formatResource(appIdToDelete)}`, flags);

      await controlApi.deleteApp(appIdToDelete);

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            app: {
              id: app.id,
              name: app.name,
            },
            timestamp: new Date().toISOString(),
          },
          flags,
        );
      }

      this.logSuccessMessage("App deleted successfully.", flags);

      // If we deleted the current app, run switch command to select a new one
      if (isDeletingCurrentApp) {
        this.logProgress(
          "The current app was deleted. Switching to another app",
          flags,
        );

        // Create a new instance of AppsSwitch and run it
        const switchCommand = new AppsSwitch(this.argv, this.config);
        await switchCommand.run();
      }
    } catch (error) {
      this.fail(error, flags, "appDelete", {
        appId: appIdToDelete,
        status: "error",
      });
    }
  }

  private promptForAppName(appName: string): Promise<boolean> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise<boolean>((resolve) => {
      rl.question(
        `For confirmation, please enter the app name (${appName}): `,
        (answer) => {
          rl.close();
          resolve(answer === appName);
        },
      );
    });
  }
}
