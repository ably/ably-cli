import { Flags } from "@oclif/core";
import stripAnsi from "strip-ansi";

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

    let reauthNote = "";
    if (flags["allow-reauth-margin"]) {
      reauthNote =
        " Connected clients have a 30s grace period to obtain new tokens before disconnection.";
    }

    try {
      const rest = await this.createAblyRestClient({
        ...flags,
        "api-key": apiKey,
      });
      if (!rest) return;

      const response = await rest.auth.revokeTokens(
        [{ type: clientId ? "clientId" : "revocationKey", value: targetValue }],
        flags["allow-reauth-margin"] ? { allowReauthMargin: true } : undefined,
      );

      const failure = response.results.find((result) => "error" in result);
      if (failure && "error" in failure) {
        this.fail(failure.error, flags, "revokeToken", {
          target: targetSpecifier,
        });
      }

      const successMessage = `Tokens matching ${targetLabel.toLowerCase()} ${formatResource(targetValue)} have been revoked.${reauthNote}`;

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            revocation: {
              allowReauthMargin: flags["allow-reauth-margin"],
              message: stripAnsi(successMessage),
              target: targetSpecifier,
              response,
            },
          },
          flags,
        );
      } else {
        this.logSuccessMessage(successMessage, flags);
      }
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404) {
        this.fail(
          "No matching tokens found or already revoked",
          flags,
          "revokeToken",
        );
      }

      this.fail(error, flags, "revokeToken");
    }
  }
}
