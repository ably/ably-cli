import { Flags } from "@oclif/core";
import * as https from "node:https";

import { AblyBaseCommand } from "../../base-command.js";
import { forceFlag, productApiFlags } from "../../flags.js";
import { formatLabel, formatResource } from "../../utils/output.js";
import { promptForConfirmation } from "../../utils/prompt-confirmation.js";

export default class RevokeTokenCommand extends AblyBaseCommand {
  static description = "Revoke tokens by client ID or revocation key";

  static examples = [
    `$ ably auth revoke-token --client-id "userClientId"`,
    `$ ably auth revoke-token --client-id "userClientId" --force`,
    `$ ably auth revoke-token --revocation-key group1`,
    `$ ably auth revoke-token --client-id "userClientId" --allow-reauth-margin`,
    `$ ably auth revoke-token --client-id "userClientId" --json --force`,
  ];

  static flags = {
    ...productApiFlags,
    ...forceFlag,
    app: Flags.string({
      description: "The app ID or name (defaults to current app)",
      env: "ABLY_APP_ID",
    }),
    "client-id": Flags.string({
      description: "Revoke all tokens issued to this client ID",
      exclusive: ["revocation-key"],
    }),
    "revocation-key": Flags.string({
      description:
        "Revoke all tokens matching this revocation key (JWT tokens only)",
      exclusive: ["client-id"],
    }),
    "allow-reauth-margin": Flags.boolean({
      default: false,
      description:
        "Delay enforcement by 30s so connected clients can obtain a new token before disconnection.",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(RevokeTokenCommand);

    const clientId = flags["client-id"];
    const revocationKey = flags["revocation-key"];

    // Require at least one target specifier
    if (!clientId && !revocationKey) {
      this.fail(
        "Either --client-id or --revocation-key must be provided",
        flags,
        "revokeToken",
      );
    }

    // Build target specifier
    const targetSpecifier = clientId
      ? `clientId:${clientId}`
      : `revocationKey:${revocationKey}`;
    const targetLabel = clientId ? "Client ID" : "Revocation Key";
    const targetValue = (clientId ?? revocationKey)!;

    // JSON mode guard — fail fast before config lookup
    if (!flags.force && this.shouldOutputJson(flags)) {
      this.fail(
        "The --force flag is required when using --json to confirm revocation",
        flags,
        "revokeToken",
      );
    }

    // Get app and key
    const appAndKey = await this.ensureAppAndKey(flags);
    if (!appAndKey) {
      return;
    }

    const { apiKey } = appAndKey;

    // Interactive confirmation
    if (!flags.force && !this.shouldOutputJson(flags)) {
      this.logToStderr(`\nYou are about to revoke all tokens matching:`);
      this.logToStderr(
        `${formatLabel(targetLabel)} ${formatResource(targetValue)}`,
      );

      const confirmed = await promptForConfirmation(
        "\nThis will permanently revoke all matching tokens, and any applications using those tokens will need to be issued new tokens. Are you sure?",
      );

      if (!confirmed) {
        this.logWarning("Revocation cancelled.", flags);
        return;
      }
    }

    try {
      // Extract the keyName (appId.keyId) from the API key
      const keyParts = apiKey.split(":");
      if (keyParts.length !== 2) {
        this.fail(
          "Invalid API key format. Expected format: appId.keyId:secret",
          flags,
          "revokeToken",
        );
      }

      const keyName = keyParts[0]!;
      const secret = keyParts[1]!;

      const requestBody: Record<string, unknown> = {
        targets: [targetSpecifier],
      };

      let reauthNote = "";
      if (flags["allow-reauth-margin"]) {
        requestBody.allowReauthMargin = true;
        reauthNote =
          " Connected clients have a 30s grace period to obtain new tokens before disconnection.";
      }

      try {
        // Make direct HTTPS request to Ably REST API
        const response = await this.makeHttpRequest(
          keyName,
          secret,
          requestBody,
        );
        const successMessage = `Tokens matching ${targetLabel.toLowerCase()} ${formatResource(targetValue)} have been revoked.${reauthNote}`;

        if (this.shouldOutputJson(flags)) {
          this.logJsonResult(
            {
              revocation: {
                allowReauthMargin: flags["allow-reauth-margin"],
                message: successMessage,
                target: targetSpecifier,
                response,
              },
            },
            flags,
          );
        } else {
          this.logSuccessMessage(successMessage, flags);
        }
      } catch (requestError: unknown) {
        const error = requestError as Error;
        if (error.message && error.message.includes("token_not_found")) {
          this.fail(
            "No matching tokens found or already revoked",
            flags,
            "revokeToken",
          );
        } else {
          throw requestError;
        }
      }
    } catch (error) {
      this.fail(error, flags, "revokeToken");
    }
  }

  // Helper method to make a direct HTTP request to the Ably REST API
  private makeHttpRequest(
    keyName: string,
    secret: string,
    requestBody: Record<string, unknown>,
  ): Promise<Record<string, unknown> | string | null> {
    return new Promise((resolve, reject) => {
      const encodedAuth = Buffer.from(`${keyName}:${secret}`).toString(
        "base64",
      );

      const options = {
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${encodedAuth}`,
          "Content-Type": "application/json",
        },
        hostname: "rest.ably.io",
        method: "POST",
        path: `/keys/${keyName}/revokeTokens`,
        port: 443,
      };

      const req = https.request(options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const jsonResponse: Record<string, unknown> | null =
                data.length > 0
                  ? (JSON.parse(data) as Record<string, unknown>)
                  : null;
              resolve(jsonResponse);
            } catch {
              resolve(data);
            }
          } else {
            reject(
              new Error(
                `Request failed with status code ${res.statusCode}: ${data}`,
              ),
            );
          }
        });
      });

      req.on("error", (error) => {
        reject(error);
      });

      req.write(JSON.stringify(requestBody));
      req.end();
    });
  }
}
