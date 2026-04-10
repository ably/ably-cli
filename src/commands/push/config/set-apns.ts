import { Flags } from "@oclif/core";
import * as fs from "node:fs";
import * as path from "node:path";

import { ControlBaseCommand } from "../../../control-base-command.js";
import { formatResource } from "../../../utils/output.js";

export default class PushConfigSetApns extends ControlBaseCommand {
  static override description = "Configure APNs push notifications for an app";

  static override examples = [
    "<%= config.bin %> <%= command.id %> --certificate /path/to/cert.p12",
    "<%= config.bin %> <%= command.id %> --certificate /path/to/cert.p12 --password secret --sandbox",
    "<%= config.bin %> <%= command.id %> --key-file /path/to/key.p8 --key-id ABC123 --team-id DEF456 --topic com.example.app",
    "<%= config.bin %> <%= command.id %> --certificate /path/to/cert.p12 --json",
  ];

  static override flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "The app ID or name (defaults to current app)",
    }),
    certificate: Flags.string({
      description: "Path to the P12 certificate file",
      exclusive: ["key-file"],
    }),
    "key-file": Flags.string({
      description: "Path to the P8 key file",
      exclusive: ["certificate"],
    }),
    "key-id": Flags.string({
      description: "The APNs key ID (required for P8)",
    }),
    password: Flags.string({
      description: "Password for the P12 certificate",
    }),
    sandbox: Flags.boolean({
      default: false,
      description: "Use the APNs sandbox environment",
    }),
    "team-id": Flags.string({
      description: "The Apple Developer Team ID (required for P8)",
    }),
    topic: Flags.string({
      description: "The APNs topic / bundle ID (required for P8)",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushConfigSetApns);

    if (!flags.certificate && !flags["key-file"]) {
      this.fail(
        "Either --certificate (P12) or --key-file (P8) must be provided",
        flags,
        "pushConfigSetApns",
      );
    }

    await this.runControlCommand(
      flags,
      async (controlApi) => {
        const appId = await this.requireAppId(flags);

        if (flags.certificate) {
          const certPath = path.resolve(flags.certificate);
          const certExt = path.extname(certPath).toLowerCase();
          if (certExt !== ".p12" && certExt !== ".pfx") {
            this.fail(
              `Invalid certificate file type: expected a .p12 or .pfx file, got "${certExt || "(no extension)"}".`,
              flags,
              "pushConfigSetApns",
            );
          }

          if (!fs.existsSync(certPath)) {
            this.fail(
              `Certificate file not found: ${certPath}`,
              flags,
              "pushConfigSetApns",
            );
          }

          this.logProgress(
            `Uploading APNs P12 certificate for app ${formatResource(appId)}`,
            flags,
          );

          const certificateData = fs.readFileSync(certPath);

          const result = await controlApi.uploadApnsP12(
            appId,
            certificateData,
            {
              password: flags.password,
              useForSandbox: flags.sandbox,
            },
          );

          if (this.shouldOutputJson(flags)) {
            this.logJsonResult(
              { config: { appId, method: "p12", ...result } },
              flags,
            );
          } else {
            this.logSuccessMessage(
              `APNs P12 certificate uploaded for app ${formatResource(appId)}.`,
              flags,
            );
          }
        } else if (flags["key-file"]) {
          if (!flags["key-id"]) {
            this.fail(
              "--key-id is required when using --key-file (P8)",
              flags,
              "pushConfigSetApns",
            );
          }
          if (!flags["team-id"]) {
            this.fail(
              "--team-id is required when using --key-file (P8)",
              flags,
              "pushConfigSetApns",
            );
          }
          if (!flags.topic) {
            this.fail(
              "--topic is required when using --key-file (P8)",
              flags,
              "pushConfigSetApns",
            );
          }

          const keyPath = path.resolve(flags["key-file"]);
          const keyExt = path.extname(keyPath).toLowerCase();
          if (keyExt !== ".p8") {
            this.fail(
              `Invalid key file type: expected a .p8 file, got "${keyExt || "(no extension)"}".`,
              flags,
              "pushConfigSetApns",
            );
          }

          if (!fs.existsSync(keyPath)) {
            this.fail(
              `Key file not found: ${keyPath}`,
              flags,
              "pushConfigSetApns",
            );
          }

          this.logProgress(
            `Configuring APNs P8 key for app ${formatResource(appId)}`,
            flags,
          );

          const keyContents = fs.readFileSync(keyPath, "utf8");

          await controlApi.updateApp(appId, {
            apnsAuthType: "token",
            apnsIssuerKey: flags["team-id"],
            apnsSigningKey: keyContents,
            apnsSigningKeyId: flags["key-id"],
            apnsTopicHeader: flags.topic,
            apnsUseSandboxEndpoint: flags.sandbox,
          });

          if (this.shouldOutputJson(flags)) {
            this.logJsonResult({ config: { appId, method: "p8" } }, flags);
          } else {
            this.logSuccessMessage(
              `APNs P8 key configured for app ${formatResource(appId)}.`,
              flags,
            );
          }
        }
      },
      "Error configuring APNs",
    );
  }
}
