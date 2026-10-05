import { Flags } from "@oclif/core";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";

import { AblyBaseCommand } from "../../base-command.js";
import { productApiFlags } from "../../flags.js";
import {
  formatClientId,
  formatLabel,
  formatSuccess,
} from "../../utils/output.js";

interface JwtPayload {
  exp: number;
  iat: number;
  jti: string;
  "x-ably-appId": string;
  "x-ably-capability": Record<string, string[]>;
  "x-ably-clientId"?: string;
  "x-ably-clientType"?: "server";
}

export default class IssueJwtTokenCommand extends AblyBaseCommand {
  static description = "Create an Ably JWT token with capabilities";

  static examples = [
    "$ ably auth issue-jwt-token",
    '$ ably auth issue-jwt-token --capability \'{"*":["*"]}\'',
    '$ ably auth issue-jwt-token --capability \'{"chat:*":["publish","subscribe"], "status:*":["subscribe"]}\' --ttl 3600',
    "$ ably auth issue-jwt-token --client-id client123 --ttl 86400",
    "$ ably auth issue-jwt-token --client-type server --client-id backend-worker",
    "$ ably auth issue-jwt-token --json",
    "$ ably auth issue-jwt-token --pretty-json",
    "$ ably auth issue-jwt-token --token-only",
    '$ ABLY_TOKEN="$(ably auth issue-jwt-token --token-only)" ably channels publish my-channel "Hello"',
  ];

  static flags = {
    ...productApiFlags,
    app: Flags.string({
      description: "The app ID or name (defaults to current app)",
      env: "ABLY_APP_ID",
    }),
    capability: Flags.string({
      default: '{"*":["*"]}',
      description:
        'Capabilities JSON string (e.g. {"channel":["publish","subscribe"]})',
    }),
    "client-id": Flags.string({
      description:
        'Client ID to issue the token to (defaults to the client ID the CLI acts as). Use "none" to issue a token with no client ID.',
    }),
    "client-type": Flags.string({
      description:
        "Classify clients using the token as servers, exempt from MAU counting, by adding the signed x-ably-clientType claim",
      options: ["server"],
    }),
    "token-only": Flags.boolean({
      default: false,
      description:
        "Output only the token string without any formatting or additional information",
    }),

    ttl: Flags.integer({
      default: 3600, // 1 hour
      description: "Time to live in seconds",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(IssueJwtTokenCommand);

    // Get app and key
    const appAndKey = await this.ensureAppAndKey(flags);
    if (!appAndKey) {
      return;
    }

    const { apiKey, appId } = appAndKey;

    try {
      // Parse the API key to get keyId and keySecret
      const [keyId, keySecret] = apiKey.split(":");

      if (!keyId || !keySecret) {
        this.fail(
          "Invalid API key format. Expected format: keyId:keySecret",
          flags,
          "issueJwtToken",
        );
      }

      // Parse capabilities
      let capabilities: Record<string, string[]>;
      try {
        capabilities = JSON.parse(flags.capability) as Record<string, string[]>;
      } catch (error) {
        this.fail(error, flags, "issueJwtToken", {
          context: "parsing capability JSON",
        });
      }

      // Create JWT payload
      const jwtPayload: JwtPayload = {
        exp: Math.floor(Date.now() / 1000) + flags.ttl, // expiration
        iat: Math.floor(Date.now() / 1000), // issued at
        jti: randomUUID(), // unique token ID
        "x-ably-appId": appId,
        "x-ably-capability": capabilities,
      };

      const clientId = this.resolveTokenClientId(flags);
      if (clientId !== undefined) jwtPayload["x-ably-clientId"] = clientId;

      const clientType = flags["client-type"] as "server" | undefined;
      if (clientType) jwtPayload["x-ably-clientType"] = clientType;

      // Sign the JWT
      const token = jwt.sign(jwtPayload, keySecret, {
        algorithm: "HS256",
        keyid: keyId,
      });

      // If token-only flag is set, output just the token string
      if (flags["token-only"]) {
        if (this.shouldOutputJson(flags)) {
          this.logJsonResult({ token: { value: token } }, flags);
        } else {
          this.log(token);
        }
        return;
      }

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            token: {
              appId,
              capability: capabilities,
              clientId: clientId ?? null,
              ...(clientType ? { clientType } : {}),
              expires: new Date(jwtPayload.exp * 1000).toISOString(),
              issued: new Date(jwtPayload.iat * 1000).toISOString(),
              keyId,
              tokenType: "jwt",
              ttl: flags.ttl,
              value: token,
            },
          },
          flags,
        );
      } else {
        this.log(formatSuccess("Ably JWT token generated."));
        this.log(`${formatLabel("Token")} ${token}`);
        this.log(`${formatLabel("Type")} JWT`);
        this.log(
          `${formatLabel("Issued")} ${new Date(jwtPayload.iat * 1000).toISOString()}`,
        );
        this.log(
          `${formatLabel("Expires")} ${new Date(jwtPayload.exp * 1000).toISOString()}`,
        );
        this.log(`${formatLabel("TTL")} ${flags.ttl} seconds`);
        this.log(`${formatLabel("App ID")} ${appId}`);
        this.log(`${formatLabel("Key ID")} ${keyId}`);
        this.log(
          `${formatLabel("Client ID")} ${clientId ? formatClientId(clientId) : "anonymous"}`,
        );
        if (clientType) {
          this.log(`${formatLabel("Client Type")} ${clientType}`);
        }
        this.log(
          `${formatLabel("Capability")} ${this.formatJsonOutput(capabilities, flags)}`,
        );
      }
    } catch (error) {
      this.fail(error, flags, "issueJwtToken");
    }
  }
}
