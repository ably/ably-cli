import { Args, Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../control-base-command.js";
import { formatLabel, formatResource } from "../../utils/output.js";

export default class AppsUpdateCommand extends ControlBaseCommand {
  static args = {
    appNameOrId: Args.string({
      description: "App name or ID to update",
      required: true,
    }),
  };

  static description = "Update an app";

  static examples = [
    '$ ably apps update "My App" --name "Updated App Name"',
    "$ ably apps update app-id --tls-only",
    '$ ably apps update "My App" --name "Updated App Name" --json',
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,
    name: Flags.string({
      description: "New name for the app",
    }),
    "tls-only": Flags.boolean({
      description: "Whether the app should accept TLS connections only",
    }),
  };

  async run(): Promise<void> {
    const { args, flags: rawFlags } = await this.parse(AppsUpdateCommand);

    // tls-only is typed as `boolean` by oclif but is actually `boolean | undefined` at runtime
    const flags = rawFlags as Omit<typeof rawFlags, "tls-only"> & {
      "tls-only": boolean | undefined;
    };

    // Ensure at least one update parameter is provided
    if (flags.name === undefined && flags["tls-only"] === undefined) {
      this.fail(
        "At least one update parameter (--name or --tls-only) must be provided",
        flags,
        "appUpdate",
        { appNameOrId: args.appNameOrId },
      );
    }

    // The appNameOrId arg accepts two formats:
    //   1. App name  — e.g. "My App"  (human-readable, may contain spaces)
    //   2. App ID    — e.g. "s57drg"  (the Ably-assigned app ID)
    const appId = await this.resolveAppIdFromNameOrId(args.appNameOrId, flags);

    try {
      const controlApi = this.createControlApi(flags);
      this.logProgress(`Updating app ${formatResource(appId)}`, flags);

      const updateData: { name?: string; tlsOnly?: boolean } = {};

      if (flags.name !== undefined) {
        updateData.name = flags.name as string;
      }

      if (flags["tls-only"] !== undefined) {
        updateData.tlsOnly = flags["tls-only"];
      }

      const app = await controlApi.updateApp(appId, updateData);

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
              ...(app.apnsUsesSandboxCert !== undefined && {
                apnsUsesSandboxCert: app.apnsUsesSandboxCert,
              }),
            },
            timestamp: new Date().toISOString(),
          },
          flags,
        );
      } else {
        this.log(`${formatLabel("App ID")} ${app.id}`);
        this.log(`${formatLabel("Name")} ${app.name}`);
        this.log(`${formatLabel("Status")} ${app.status}`);
        this.log(`${formatLabel("Account ID")} ${app.accountId}`);
        this.log(`${formatLabel("TLS Only")} ${app.tlsOnly ? "Yes" : "No"}`);
        this.log(`${formatLabel("Created")} ${this.formatDate(app.created)}`);
        this.log(`${formatLabel("Updated")} ${this.formatDate(app.modified)}`);
        if (app.apnsUsesSandboxCert !== undefined) {
          this.log(
            `${formatLabel("APNS Uses Sandbox Cert")} ${app.apnsUsesSandboxCert ? "Yes" : "No"}`,
          );
        }
      }

      this.logSuccessMessage("App updated successfully.", flags);
    } catch (error) {
      this.fail(error, flags, "appUpdate", { appId });
    }
  }
}
