import { Flags } from "@oclif/core";
import { SignJWT } from "jose";
import { randomUUID } from "node:crypto";

import { AblyBaseCommand } from "../../base-command.js";

export default class IssueJwtTokenCommand extends AblyBaseCommand {
  static description = "Creates an Ably JWT token with capabilities";

  static examples = [
    "$ ably auth issue-jwt-token",
    '$ ably auth issue-jwt-token --capability \'{"*":["*"]}\'',
    '$ ably auth issue-jwt-token --capability \'{"chat:*":["publish","subscribe"], "status:*":["subscribe"]}\' --ttl 3600',
    "$ ably auth issue-jwt-token --client-id client123 --ttl 86400",
    "$ ably auth issue-jwt-token --json",
    "$ ably auth issue-jwt-token --pretty-json",
    "$ ably auth issue-jwt-token --token-only",
    '$ ably channels publish --token "$(ably auth issue-jwt-token --token-only)" my-channel "Hello"',
  ];

  static flags = {
    ...AblyBaseCommand.globalFlags,
    app: Flags.string({
      description: "App ID to use (uses current app if not specified)",
      env: "ABLY_APP_ID",
    }),
    capability: Flags.string({
      default: '{"*":["*"]}',
      description:
        'Capabilities JSON string (e.g. {"channel":["publish","subscribe"]})',
    }),
    "client-id": Flags.string({
      description:
        'Client ID to associate with the token. Use "none" to explicitly issue a token with no client ID, otherwise a default will be generated.',
    }),
    "token-only": Flags.boolean({
      default: false,
      description:
        "Output only the token string without any formatting or additional information",
    }),

    ttl: Flags.integer({
      default: 3600, // 1 hour
      description: "Time to live in seconds (default: 3600, 1 hour)",
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
        this.error("Invalid API key format. Expected format: keyId:keySecret");
      }

      // Parse capabilities
      let capabilities: Record<string, string[]>;
      try {
        capabilities = JSON.parse(flags.capability);
      } catch (error) {
        this.error(
          `Invalid capability JSON: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Determine client ID - use special "none" value to explicitly indicate no clientId
      let clientId: null | string = null;
      let clientIdClaim: Record<string, string> = {};
      if (flags["client-id"]) {
        if (flags["client-id"].toLowerCase() !== "none") {
          clientId = flags["client-id"];
          clientIdClaim = { "x-ably-clientId": clientId };
        }
      } else {
        // Generate a default client ID
        clientId = `ably-cli-${randomUUID().slice(0, 8)}`;
        clientIdClaim = { "x-ably-clientId": clientId };
      }

      // Timestamps for display
      const iat = Math.floor(Date.now() / 1000);
      const exp = iat + flags.ttl;

      // Sign the JWT using jose's fluent API — standard claims via setters,
      // Ably-specific custom claims passed directly to the constructor.
      const secretBytes = new TextEncoder().encode(keySecret);
      const token = await new SignJWT({
        "x-ably-appId": appId,
        "x-ably-capability": capabilities,
        ...clientIdClaim,
      })
        .setProtectedHeader({ alg: "HS256", kid: keyId })
        .setIssuedAt(iat)
        .setExpirationTime(exp)
        .setJti(randomUUID())
        .sign(secretBytes);

      // If token-only flag is set, output just the token string
      if (flags["token-only"]) {
        this.log(token);
        return;
      }

      if (this.shouldOutputJson(flags)) {
        this.log(
          this.formatJsonOutput(
            {
              appId,
              capability: capabilities,
              clientId,
              expires: new Date(exp * 1000).toISOString(),
              issued: new Date(iat * 1000).toISOString(),
              keyId,
              token,
              ttl: flags.ttl,
              type: "jwt",
            },
            flags,
          ),
        );
      } else {
        this.log("Generated Ably JWT Token:");
        this.log(`Token: ${token}`);
        this.log(`Type: JWT`);
        this.log(`Issued: ${new Date(iat * 1000).toISOString()}`);
        this.log(`Expires: ${new Date(exp * 1000).toISOString()}`);
        this.log(`TTL: ${flags.ttl} seconds`);
        this.log(`App ID: ${appId}`);
        this.log(`Key ID: ${keyId}`);
        this.log(`Client ID: ${clientId ?? "None"}`);
        this.log(`Capability: ${this.formatJsonOutput(capabilities, flags)}`);
      }
    } catch (error) {
      this.error(
        `Error issuing JWT token: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
