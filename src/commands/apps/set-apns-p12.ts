import { Args, Flags } from "@oclif/core";
import * as fs from "node:fs";
import * as path from "node:path";

import { ControlBaseCommand } from "../../control-base-command.js";
import {
  formatLabel,
  formatProgress,
  formatResource,
  formatSuccess,
  formatWarning,
} from "../../utils/output.js";

export default class AppsSetApnsP12Command extends ControlBaseCommand {
  static args = {
    id: Args.string({
      description: "App ID to set the APNS certificate for",
      required: true,
    }),
  };

  static description =
    "Upload Apple Push Notification Service P12 certificate for an app";

  static hidden = true;

  static examples = [
    "$ ably apps set-apns-p12 app-id --certificate /path/to/certificate.p12",
    '$ ably apps set-apns-p12 app-id --certificate /path/to/certificate.p12 --password "YOUR_CERTIFICATE_PASSWORD"',
    "$ ably apps set-apns-p12 app-id --certificate /path/to/certificate.p12 --use-for-sandbox",
    "$ ably apps set-apns-p12 app-id --certificate /path/to/certificate.p12 --json",
  ];

  static flags = {
    ...ControlBaseCommand.globalFlags,
    certificate: Flags.string({
      description: "Path to the P12 certificate file",
      required: true,
    }),
    password: Flags.string({
      description: "Password for the P12 certificate",
    }),
    "use-for-sandbox": Flags.boolean({
      default: false,
      description:
        "Whether to use this certificate for the APNS sandbox environment",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(AppsSetApnsP12Command);

    if (!this.shouldOutputJson(flags)) {
      this.logToStderr(
        formatWarning(
          'This command is deprecated. Use "ably push config set-apns" instead.',
        ),
      );
    }

    // Display authentication information
    this.showAuthInfoIfNeeded(flags);

    try {
      const controlApi = this.createControlApi(flags);
      // Validate certificate file exists
      const certificatePath = path.resolve(flags.certificate);
      if (!fs.existsSync(certificatePath)) {
        this.fail(
          `Certificate file not found: ${certificatePath}`,
          flags,
          "appSetApnsP12",
        );
      }

      this.log(
        formatProgress(
          `Uploading APNS P12 certificate for app ${formatResource(args.id)}`,
        ),
      );

      // Read certificate file and encode as base64
      const certificateData = fs
        .readFileSync(certificatePath)
        .toString("base64");

      const result = await controlApi.uploadApnsP12(args.id, certificateData, {
        password: flags.password,
        useForSandbox: flags["use-for-sandbox"],
      });

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(result, flags);
      } else {
        this.log(formatSuccess("APNS P12 certificate uploaded."));
        this.log(`${formatLabel("Certificate ID")} ${result.id}`);
        if (flags["use-for-sandbox"]) {
          this.log(`${formatLabel("Environment")} Sandbox`);
        } else {
          this.log(`${formatLabel("Environment")} Production`);
        }
      }
    } catch (error) {
      this.fail(error, flags, "appSetApnsP12");
    }
  }
}
