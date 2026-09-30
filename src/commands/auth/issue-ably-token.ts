import { Flags } from "@oclif/core";
import type * as Ably from "@ably/pubsub-core";

import { AblyBaseCommand } from "../../base-command.js";
import { productApiFlags } from "../../flags.js";
import {
  formatClientId,
  formatLabel,
  formatSuccess,
} from "../../utils/output.js";

export default class IssueAblyTokenCommand extends AblyBaseCommand {
  static description = "Create an Ably Token with capabilities";

  static examples = [
    "$ ably auth issue-ably-token",
    '$ ably auth issue-ably-token --capability \'{"*":["*"]}\'',
    '$ ably auth issue-ably-token --capability \'{"chat:*":["publish","subscribe"], "status:*":["subscribe"]}\' --ttl 3600',
    "$ ably auth issue-ably-token --client-id client123 --ttl 86400",
    '$ ably auth issue-ably-token --client-id "none" --ttl 3600',
    "$ ably auth issue-ably-token --json",
    "$ ably auth issue-ably-token --pretty-json",
    "$ ably auth issue-ably-token --token-only",
    '$ ABLY_TOKEN="$(ably auth issue-ably-token --token-only)" ably channels publish my-channel "Hello"',
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
    const { flags } = await this.parse(IssueAblyTokenCommand);

    // Get app and key
    const appAndKey = await this.ensureAppAndKey(flags);
    if (!appAndKey) {
      return;
    }

    const { apiKey } = appAndKey;

    try {
      // Parse capabilities
      let capabilities: { [key: string]: Ably.capabilityOp[] | ["*"] };
      try {
        capabilities = JSON.parse(flags.capability) as {
          [key: string]: Ably.capabilityOp[] | ["*"];
        };
      } catch (error) {
        this.fail(error, flags, "issueAblyToken", {
          context: "parsing capability JSON",
        });
      }

      // Create token params
      const tokenParams: Ably.TokenParams = {
        capability: capabilities,
        ttl: flags.ttl * 1000, // Convert to milliseconds for Ably SDK
      };

      const clientId = this.resolveTokenClientId(flags);
      if (clientId !== undefined) tokenParams.clientId = clientId;

      // Create Ably REST client and request token
      const rest = await this.createAblyRestClient(
        { ...flags, "api-key": apiKey },
        {
          skipAuthInfo: flags["token-only"],
        },
      );
      if (!rest) {
        return;
      }
      const tokenRequest = await rest.auth.createTokenRequest(tokenParams);

      // Use the token request to get an actual token
      const tokenDetails = await rest.auth.requestToken(tokenRequest);

      // If token-only flag is set, output just the token string
      if (flags["token-only"]) {
        if (this.shouldOutputJson(flags)) {
          this.logJsonResult({ token: { value: tokenDetails.token } }, flags);
        } else {
          this.log(tokenDetails.token);
        }
        return;
      }

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            token: {
              value: tokenDetails.token,
              issuedAt: new Date(tokenDetails.issued).toISOString(),
              expiresAt: new Date(tokenDetails.expires).toISOString(),
              clientId: tokenDetails.clientId ?? null,
              capability: tokenDetails.capability,
            },
          },
          flags,
        );
      } else {
        this.log(formatSuccess("Ably token generated."));
        this.log(`${formatLabel("Token")} ${tokenDetails.token}`);
        this.log(`${formatLabel("Type")} Ably`);
        this.log(
          `${formatLabel("Issued")} ${new Date(tokenDetails.issued).toISOString()}`,
        );
        this.log(
          `${formatLabel("Expires")} ${new Date(tokenDetails.expires).toISOString()}`,
        );
        this.log(`${formatLabel("TTL")} ${flags.ttl} seconds`);
        this.log(
          `${formatLabel("Client ID")} ${tokenDetails.clientId ? formatClientId(tokenDetails.clientId) : "anonymous"}`,
        );
        this.log(
          `${formatLabel("Capability")} ${this.formatJsonOutput({ capability: tokenDetails.capability }, flags)}`,
        );
      }
    } catch (error) {
      this.fail(error, flags, "issueAblyToken");
    }
  }
}
