import { Args } from "@oclif/core";

import { ControlBaseCommand } from "../../control-base-command.js";
import { ControlApi } from "../../services/control-api.js";
import { formatResource } from "../../utils/output.js";

export default class AppsSwitch extends ControlBaseCommand {
  static override args = {
    appId: Args.string({
      description: "ID of the app to switch to",
      required: false,
    }),
  };

  static override description = "Switch to a different Ably app";

  static override examples = [
    "<%= config.bin %> <%= command.id %> APP_ID",
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> APP_ID --json",
  ];

  static override flags = {
    ...ControlBaseCommand.globalFlags,
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(AppsSwitch);

    try {
      const controlApi = this.createControlApi({});

      // If app ID is provided, switch directly
      if (args.appId) {
        await this.switchToApp(args.appId, controlApi, flags);
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
            { appId: selectedApp.id, appName: selectedApp.name },
            flags,
          );
        } else {
          this.log(
            `Switched to app: ${formatResource(selectedApp.name)} (${selectedApp.id})`,
          );
        }
      } else {
        if (!this.shouldOutputJson(flags)) {
          this.log("App switch cancelled.");
        }
      }
    } catch (error) {
      this.fail(error, flags, "AppSwitch");
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
        this.logJsonResult({ appId: app.id, appName: app.name }, flags);
      } else {
        this.log(`Switched to app: ${formatResource(app.name)} (${app.id})`);
      }
    } catch (error) {
      this.fail(error, flags, "AppSwitch", {
        context: `switching to app "${appId}"`,
      });
    }
  }
}
