import { Flags } from "@oclif/core";
import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";

import { ControlBaseCommand } from "../../../control-base-command.js";

interface ServiceAccount {
  project_id?: string;
  type?: string;
  client_email?: string;
  [key: string]: unknown;
}

export default class PushConfigSetFcm extends ControlBaseCommand {
  static override description =
    "Configure Firebase Cloud Messaging (FCM) credentials for an app using a service account JSON file.";

  static override examples = [
    "$ ably push config set-fcm --service-account ./firebase-service-account.json",
    "$ ably push config set-fcm --app my-app --service-account ./firebase-prod.json",
  ];

  static override flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "App ID or name to configure",
    }),
    "service-account": Flags.string({
      description: "Path to Firebase service account JSON file",
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushConfigSetFcm);

    await this.runControlCommand(
      flags,
      async (api) => {
        const appId = await this.resolveAppId(flags);

        // Read and validate service account JSON
        const serviceAccountPath = path.resolve(
          flags["service-account"] as string,
        );

        if (!fs.existsSync(serviceAccountPath)) {
          this.error(`Service account file not found: ${serviceAccountPath}`);
        }

        let serviceAccountJson: string;
        let serviceAccount: ServiceAccount;

        try {
          serviceAccountJson = fs.readFileSync(serviceAccountPath, "utf8");
          serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccount;
        } catch {
          this.error(
            `Invalid JSON in service account file: ${serviceAccountPath}`,
          );
        }

        // Validate it looks like a service account
        if (serviceAccount.type !== "service_account") {
          this.error(
            `Invalid service account file: expected "type": "service_account" field. ` +
              `Got type: "${serviceAccount.type || "undefined"}"`,
          );
        }

        if (!serviceAccount.project_id) {
          this.error(
            `Invalid service account file: missing "project_id" field`,
          );
        }

        if (!this.shouldOutputJson(flags)) {
          this.log(
            `Configuring FCM credentials for app ${appId} with project "${serviceAccount.project_id}"...`,
          );
        }

        // Update app with FCM configuration
        await api.updateApp(appId, {
          fcmServiceAccount: serviceAccountJson,
        } as Record<string, unknown>);

        if (this.shouldOutputJson(flags)) {
          this.log(
            this.formatJsonOutput(
              {
                success: true,
                appId,
                projectId: serviceAccount.project_id,
                clientEmail: serviceAccount.client_email || null,
              },
              flags,
            ),
          );
        } else {
          this.log(chalk.green("\nFCM credentials configured successfully!"));
          this.log(
            `${chalk.dim("Project ID:")}     ${serviceAccount.project_id}`,
          );
          if (serviceAccount.client_email) {
            this.log(
              `${chalk.dim("Service Account:")} ${serviceAccount.client_email}`,
            );
          }
        }
      },
      "Error configuring FCM",
    );
  }
}
