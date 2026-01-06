import { Flags } from "@oclif/core";
import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";

import { ControlBaseCommand } from "../../../control-base-command.js";

export default class PushConfigSetApns extends ControlBaseCommand {
  static override description =
    "Configure Apple Push Notification service (APNs) credentials for an app. Supports both certificate-based (.p12) and token-based (.p8) authentication.";

  static override examples = [
    // Certificate-based authentication
    "$ ably push config set-apns --certificate ./cert.p12 --password SECRET",
    "$ ably push config set-apns --app my-app --certificate ./push-prod.p12",
    // Token-based authentication
    "$ ably push config set-apns --key-file ./AuthKey.p8 --key-id ABC123 --team-id XYZ789 --bundle-id com.myapp",
  ];

  static override flags = {
    ...ControlBaseCommand.globalFlags,
    app: Flags.string({
      description: "App ID or name to configure",
    }),
    // Certificate-based auth flags
    certificate: Flags.string({
      description: "Path to .p12 certificate file",
    }),
    password: Flags.string({
      description: "Password for the .p12 certificate",
    }),
    // Token-based auth flags
    "key-file": Flags.string({
      description: "Path to .p8 private key file (token-based auth)",
    }),
    "key-id": Flags.string({
      description: "Key ID from Apple Developer portal (token-based auth)",
    }),
    "team-id": Flags.string({
      description: "Team ID from Apple Developer portal (token-based auth)",
    }),
    "bundle-id": Flags.string({
      description: "App bundle identifier (token-based auth)",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PushConfigSetApns);

    // Validate that either certificate or key-file is provided
    if (!flags.certificate && !flags["key-file"]) {
      this.error(
        "Either --certificate (for .p12) or --key-file (for .p8 token auth) must be specified",
      );
    }

    if (flags.certificate && flags["key-file"]) {
      this.error(
        "Cannot use both --certificate and --key-file. Choose one authentication method.",
      );
    }

    // Validate token-based auth requires all fields
    if (
      flags["key-file"] &&
      (!flags["key-id"] || !flags["team-id"] || !flags["bundle-id"])
    ) {
      this.error(
        "Token-based auth requires --key-file, --key-id, --team-id, and --bundle-id",
      );
    }

    await this.runControlCommand(
      flags,
      async (api) => {
        const appId = await this.resolveAppId(flags);

        if (flags.certificate) {
          // Certificate-based authentication (P12)
          return this.uploadP12Certificate(api, appId, flags);
        } else {
          // Token-based authentication (P8)
          return this.configureTokenAuth(api, appId, flags);
        }
      },
      "Error configuring APNs",
    );
  }

  private async uploadP12Certificate(
    api: ReturnType<typeof this.createControlApi>,
    appId: string,
    flags: Record<string, unknown>,
  ): Promise<void> {
    const certificatePath = path.resolve(flags.certificate as string);

    if (!fs.existsSync(certificatePath)) {
      this.error(`Certificate file not found: ${certificatePath}`);
    }

    this.log(`Uploading APNs P12 certificate for app ${appId}...`);

    // Read certificate file as Buffer
    const certificateData = fs.readFileSync(certificatePath);

    const result = await api.uploadApnsP12(appId, certificateData, {
      password: flags.password as string | undefined,
    });

    // Note: Sandbox vs Production is determined by the certificate type
    // (Development vs Distribution certificate from Apple Developer Portal)

    if (this.shouldOutputJson(flags)) {
      this.log(
        this.formatJsonOutput(
          {
            success: true,
            appId,
            authType: "certificate",
            certificateId: result.id,
          },
          flags,
        ),
      );
    } else {
      this.log(chalk.green("\nAPNs P12 certificate uploaded successfully!"));
      this.log(`${chalk.dim("Certificate ID:")} ${result.id}`);
    }
  }

  private async configureTokenAuth(
    api: ReturnType<typeof this.createControlApi>,
    appId: string,
    flags: Record<string, unknown>,
  ): Promise<void> {
    const keyFilePath = path.resolve(flags["key-file"] as string);

    if (!fs.existsSync(keyFilePath)) {
      this.error(`Key file not found: ${keyFilePath}`);
    }

    this.log(`Configuring APNs token-based authentication for app ${appId}...`);

    // Read the P8 key file
    const privateKey = fs.readFileSync(keyFilePath, "utf8");

    // Update app with APNs token auth configuration
    await api.updateApp(appId, {
      apnsPrivateKey: privateKey,
      applePushKeyId: flags["key-id"] as string,
      applePushTeamId: flags["team-id"] as string,
      applePushBundleId: flags["bundle-id"] as string,
    } as Record<string, unknown>);

    if (this.shouldOutputJson(flags)) {
      this.log(
        this.formatJsonOutput(
          {
            success: true,
            appId,
            authType: "token",
            keyId: flags["key-id"],
            teamId: flags["team-id"],
            bundleId: flags["bundle-id"],
          },
          flags,
        ),
      );
    } else {
      this.log(
        chalk.green(
          "\nAPNs token-based authentication configured successfully!",
        ),
      );
      this.log(`${chalk.dim("Key ID:")}     ${flags["key-id"]}`);
      this.log(`${chalk.dim("Team ID:")}    ${flags["team-id"]}`);
      this.log(`${chalk.dim("Bundle ID:")}  ${flags["bundle-id"]}`);
    }
  }
}
