import { Args, Flags } from "@oclif/core";

import { ControlBaseCommand } from "../../control-base-command.js";
import {
  formatLabel,
  formatProgress,
  formatResource,
} from "../../utils/output.js";

export default class AppsUpdateCommand extends ControlBaseCommand {
  static args = {
    id: Args.string({
      description: "App ID to update",
      required: true,
    }),
  };

  static description = "Update an app";

  static examples = [
    '$ ably apps update app-id --name "Updated App Name"',
    "$ ably apps update app-id --tls-only",
    '$ ably apps update app-id --name "Updated App Name" --json',
    '$ ABLY_ACCESS_TOKEN="YOUR_ACCESS_TOKEN" ably apps update app-id --name "Updated App Name"',
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
        { appId: args.id },
      );
    }

    try {
      const controlApi = this.createControlApi(flags);
      if (!this.shouldOutputJson(flags)) {
        this.log(formatProgress(`Updating app ${formatResource(args.id)}`));
      }

      const updateData: { name?: string; tlsOnly?: boolean } = {};

      if (flags.name !== undefined) {
        updateData.name = flags.name as string;
      }

      if (flags["tls-only"] !== undefined) {
        updateData.tlsOnly = flags["tls-only"];
      }

      const app = await controlApi.updateApp(args.id, updateData);

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
        this.log(`\nApp updated successfully!`);
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
    } catch (error) {
      this.fail(error, flags, "appUpdate", {
        appId: args.id,
      });
    }
  }
}
