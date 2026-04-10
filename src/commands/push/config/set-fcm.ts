import { Flags } from "@oclif/core";
import * as fs from "node:fs";
import * as path from "node:path";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { formatResource } from "../../../utils/output.js";

export default class PushConfigSetFcm extends ControlBaseCommand {
  static override description = "Configure FCM push notifications for an app";

  static override examples = [
    "<%= config.bin %> <%= command.id %> --service-account /path/to/service-account.json",
    "<%= config.bin %> <%= command.id %> --service-account /path/to/service-account.json --app my-app",
    "<%= config.bin %> <%= command.id %> --service-account /path/to/service-account.json --json",
  ];

  static override flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "The app ID or name (defaults to current app)",
    }),
    "service-account": Flags.string({
      description: "Path to the FCM service account JSON file",
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushConfigSetFcm);

    await this.runControlCommand(
      flags,
      async (controlApi) => {
        const appId = await this.requireAppId(flags);
        const filePath = path.resolve(flags["service-account"]);
        const ext = path.extname(filePath).toLowerCase();
        if (ext !== ".json") {
          this.fail(
            `Invalid service account file type: expected a .json file, got "${ext || "(no extension)"}".`,
            flags,
            "pushConfigSetFcm",
          );
        }

        if (!fs.existsSync(filePath)) {
          this.fail(
            `Service account file not found: ${filePath}`,
            flags,
            "pushConfigSetFcm",
          );
        }

        const contents = fs.readFileSync(filePath, "utf8");

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(contents) as Record<string, unknown>;
        } catch {
          this.fail(
            "Service account file is not valid JSON",
            flags,
            "pushConfigSetFcm",
          );
        }

        if (parsed.type !== "service_account") {
          this.fail(
            'Service account JSON must have "type": "service_account"',
            flags,
            "pushConfigSetFcm",
          );
        }

        if (!parsed.project_id) {
          this.fail(
            "Service account JSON must contain a project_id field",
            flags,
            "pushConfigSetFcm",
          );
        }

        this.logProgress(
          `Configuring FCM for app ${formatResource(appId)}`,
          flags,
        );

        await controlApi.updateApp(appId, {
          fcmProjectId: parsed.project_id as string,
          fcmServiceAccount: contents,
        });

        if (this.shouldOutputJson(flags)) {
          this.logJsonResult({ config: { appId, provider: "fcm" } }, flags);
        } else {
          this.logSuccessMessage(
            `FCM configuration updated for app ${formatResource(appId)}.`,
            flags,
          );
        }
      },
      "Error configuring FCM",
    );
  }
}
