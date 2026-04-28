import { Args } from "@oclif/core";

import { ControlBaseCommand } from "../../control-base-command.js";
import { formatResource } from "../../utils/output.js";

export default class AppsSwitch extends ControlBaseCommand {
  static override args = {
    appNameOrId: Args.string({
      description: "App name or ID to switch to",
      required: false,
    }),
  };

  static override description = "Switch to a different Ably app";

  static override examples = [
    '<%= config.bin %> <%= command.id %> "My App"',
    "<%= config.bin %> <%= command.id %> app-id",
    "<%= config.bin %> <%= command.id %>",
  ];

  static override flags = {
    ...ControlBaseCommand.globalFlags,
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(AppsSwitch);

    try {
      const controlApi = this.createControlApi(flags);

      // If app name or ID is provided, resolve and switch directly.
      // The appNameOrId arg accepts two formats:
      //   1. App name  — e.g. "My App"  (human-readable, may contain spaces)
      //   2. App ID    — e.g. "s57drg"  (the Ably-assigned app ID)
      if (args.appNameOrId) {
        const apps = await controlApi.listApps();
        const matchedApp = apps.find(
          (a) => a.name === args.appNameOrId || a.id === args.appNameOrId,
        );

        if (!matchedApp) {
          this.fail(
            `App "${args.appNameOrId}" not found. Run "ably apps list" to see available apps.`,
            flags,
            "appSwitch",
          );
        }

        this.saveAndReportSwitch(matchedApp, flags);
        return;
      }

      // Otherwise, show interactive selection
      if (!this.shouldOutputJson(flags)) {
        this.log("Select an app to switch to:");
      }
      const selectedApp = await this.interactiveHelper.selectApp(controlApi);

      if (selectedApp) {
        this.saveAndReportSwitch(selectedApp, flags);
      } else {
        this.logWarning("App switch cancelled.", flags);
      }
    } catch (error) {
      this.fail(error, flags, "appSwitch");
    }
  }

  private saveAndReportSwitch(
    app: { id: string; name: string },
    flags: Record<string, unknown>,
  ): void {
    this.configManager.setCurrentApp(app.id);
    this.configManager.storeAppInfo(app.id, { appName: app.name });

    if (this.shouldOutputJson(flags)) {
      this.logJsonResult({ app: { id: app.id, name: app.name } }, flags);
    } else {
      this.logSuccessMessage(
        `Switched to app ${formatResource(app.name)} (${app.id}).`,
        flags,
      );
    }
  }
}
