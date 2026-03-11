import { Args, Flags } from "@oclif/core";
import * as Ably from "ably";
import * as https from "node:https";

import { AblyBaseCommand } from "../../base-command.js";
import { productApiFlags } from "../../flags.js";

export default class RevokeTokenCommand extends AblyBaseCommand {
  static args = {
    token: Args.string({
      description: "Token to revoke",
      name: "token",
      required: true,
    }),
  };

  static description = "Revoke a token";

  static examples = [
    "$ ably auth revoke-token TOKEN",
    "$ ably auth revoke-token TOKEN --client-id clientid",
    "$ ably auth revoke-token TOKEN --json",
    "$ ably auth revoke-token TOKEN --pretty-json",
  ];

  static flags = {
    ...productApiFlags,
    app: Flags.string({
      description: "The app ID or name (defaults to current app)",
      env: "ABLY_APP_ID",
    }),

    "client-id": Flags.string({
      char: "c",
      description: "Client ID to revoke tokens for",
    }),
  };

  // Property to store the Ably client
  private ablyClient?: Ably.Realtime;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(RevokeTokenCommand);

    // Get app and key
    const appAndKey = await this.ensureAppAndKey(flags);
    if (!appAndKey) {
      return;
    }

    const { apiKey } = appAndKey;
    const { token } = args;

    try {
      // Create Ably Realtime client
      const client = await this.createAblyRealtimeClient(flags);
      if (!client) return;

      this.ablyClient = client;

      const clientId = flags["client-id"] || token;

      if (!flags["client-id"]) {
        // We need to warn the user that we're using the token as a client ID
        this.warn(
          "Revoking a specific token is only possible if it has a client ID or revocation key",
        );
        this.warn(
          "For advanced token revocation options, see: https://ably.com/docs/auth/revocation",
        );
        this.warn("Using the token argument as a client ID for this operation");
      }

      // Extract the keyName (appId.keyId) from the API key
      const keyParts = apiKey.split(":");
      if (keyParts.length !== 2) {
        this.fail(
          "Invalid API key format. Expected format: appId.keyId:secret",
          flags,
          "TokenRevoke",
        );
      }

      const keyName = keyParts[0]; // This gets the appId.keyId portion
      const secret = keyParts[1];

      // Create the properly formatted body for token revocation
      const requestBody = {
        targets: [`clientId:${clientId}`],
      };

      try {
        // Make direct HTTPS request to Ably REST API
        const response = await this.makeHttpRequest(
          keyName,
          secret,
          requestBody,
        );

        if (this.shouldOutputJson(flags)) {
          this.logJsonResult(
            {
              message: "Token revocation processed successfully",
              response,
            },
            flags,
          );
        } else {
          this.log("Token successfully revoked");
        }
      } catch (requestError: unknown) {
        // Handle specific API errors
        const error = requestError as Error;
        if (error.message && error.message.includes("token_not_found")) {
          this.fail("Token not found or already revoked", flags, "TokenRevoke");
        } else {
          throw requestError;
        }
      }
    } catch (error) {
      this.fail(error, flags, "TokenRevoke");
    }
    // Client cleanup is handled by base class finally() method
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
              const jsonResponse = data.length > 0 ? JSON.parse(data) : null;
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
