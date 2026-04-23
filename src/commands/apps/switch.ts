import { Args } from "@oclif/core";

import { ControlBaseCommand } from "../../control-base-command.js";
import { ControlApi } from "../../services/control-api.js";
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
      const controlApi = this.createControlApi({});

      // If app name or ID is provided, resolve and switch directly
      if (args.appNameOrId) {
        const appId = await this.resolveAppIdFromNameOrId(args.appNameOrId, {});
        await this.switchToApp(appId, controlApi, flags);
        return;
      }

      // Otherwise, show interactive selection
      if (!this.shouldOutputJson(flags)) {
        this.log("Select an app to switch to:");
      }
      const selectedApp = await this.interactiveHelper.selectApp(controlApi);

      if (selectedApp) {
        // Save the app info and set as current
        this.configManager.setCurrentApp(selectedApp.id);
        this.configManager.storeAppInfo(selectedApp.id, {
          appName: selectedApp.name,
        });
        if (this.shouldOutputJson(flags)) {
          this.logJsonResult(
            { app: { id: selectedApp.id, name: selectedApp.name } },
            flags,
          );
        } else {
          this.logSuccessMessage(
            `Switched to app ${formatResource(selectedApp.name)} (${selectedApp.id}).`,
            flags,
          );
        }
      } else {
        this.logWarning("App switch cancelled.", flags);
      }
    } catch (error) {
      this.fail(error, flags, "appSwitch");
    }
  }

  private async switchToApp(
    appId: string,
    controlApi: ControlApi,
    flags: Record<string, unknown>,
  ): Promise<void> {
    try {
      // Verify the app exists
      const app = await controlApi.getApp(appId);

      // Save app info and set as current
      this.configManager.setCurrentApp(appId);
      this.configManager.storeAppInfo(appId, { appName: app.name });

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult({ app: { id: app.id, name: app.name } }, flags);
      } else {
        this.logSuccessMessage(
          `Switched to app ${formatResource(app.name)} (${app.id}).`,
          flags,
        );
      }
    } catch (error) {
      this.fail(error, flags, "appSwitch", {
        context: `switching to app "${appId}"`,
      });
    }
  }
}
