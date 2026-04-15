import { Args, Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../control-base-command.js";
import { formatLabel, formatResource } from "../../utils/output.js";

export default class AppsCreateCommand extends ControlBaseCommand {
  static description = "Create a new app";

  static args = {
    appName: Args.string({
      description: "Name of the app",
      required: true,
    }),
  };

  static examples = [
    '$ ably apps create "My New App"',
    '$ ably apps create "My New App" --tls-only',
    '$ ably apps create "My New App" --json',
    '$ ABLY_ACCESS_TOKEN="YOUR_ACCESS_TOKEN" ably apps create "My New App"',
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,
    "tls-only": Flags.boolean({
      default: false,
      description: "Whether the app should accept TLS connections only",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(AppsCreateCommand);

    try {
      const controlApi = this.createControlApi(flags);
      this.logProgress(`Creating app ${formatResource(args.appName)}`, flags);

      const app = await controlApi.createApp({
        name: args.appName,
        tlsOnly: flags["tls-only"],
      });

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            app: {
              accountId: app.accountId,
              created: new Date(app.created).toISOString(),
              id: app.id,
              modified: new Date(app.modified).toISOString(),
              name: app.name,
              status: app.status,
              tlsOnly: app.tlsOnly,
            },
            timestamp: new Date().toISOString(),
          },
          flags,
        );
      }

      this.logSuccessMessage(
        `App created: ${formatResource(app.name)} (${app.id}).`,
        flags,
      );

      if (!this.shouldOutputJson(flags)) {
        this.log(`${formatLabel("App ID")} ${app.id}`);
        this.log(`${formatLabel("Name")} ${app.name}`);
        this.log(`${formatLabel("Status")} ${app.status}`);
        this.log(`${formatLabel("Account ID")} ${app.accountId}`);
        this.log(`${formatLabel("TLS Only")} ${app.tlsOnly ? "Yes" : "No"}`);
        this.log(`${formatLabel("Created")} ${this.formatDate(app.created)}`);
        this.log(`${formatLabel("Updated")} ${this.formatDate(app.modified)}`);
      }

      // Automatically switch to the newly created app if a local account exists
      if (this.configManager.getCurrentAccount()) {
        this.configManager.setCurrentApp(app.id);
        this.configManager.storeAppInfo(app.id, { appName: app.name });

        this.logSuccessMessage(
          `Automatically switched to app ${formatResource(app.name)} (${app.id}).`,
          flags,
        );
      }
    } catch (error) {
      this.fail(error, flags, "appCreate");
    }
  }
}
