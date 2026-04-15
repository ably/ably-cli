import { Args } from "@oclif/core";

import { ControlBaseCommand } from "../../control-base-command.js";
import { forceFlag } from "../../flags.js";
import { OAuthClient } from "../../services/oauth-client.js";
import { promptForConfirmation } from "../../utils/prompt-confirmation.js";

export default class AccountsLogout extends ControlBaseCommand {
  static override args = {
    accountAlias: Args.string({
      description:
        "Alias of the account to log out from (defaults to current account)",
      required: false,
    }),
  };

  static override description = "Log out from an Ably account";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> mycompany",
    "<%= config.bin %> <%= command.id %> --json",
    "<%= config.bin %> <%= command.id %> --pretty-json",
  ];

  static override flags = {
    ...ControlBaseCommand.globalFlags,
    ...forceFlag,
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(AccountsLogout);

    // Determine which account to log out from
    const targetAlias =
      args.accountAlias || this.configManager.getCurrentAccountAlias();

    if (!targetAlias) {
      this.fail(
        'No account is currently selected and no alias provided. Use "ably accounts list" to see available accounts.',
        flags,
        "accountLogout",
      );
    }

    const accounts = this.configManager.listAccounts();
    const accountExists = accounts.some(
      (account) => account.alias === targetAlias,
    );

    if (!accountExists) {
      this.fail(
        `Account with alias "${targetAlias}" not found. Use "ably accounts list" to see available accounts.`,
        flags,
        "accountLogout",
      );
    }

    // In JSON mode, require --force to prevent accidental destructive actions
    if (!flags.force && this.shouldOutputJson(flags)) {
      this.fail(
        "The --force flag is required when using --json to confirm logout",
        flags,
        "accountLogout",
      );
    }

    // Get confirmation unless force flag is used
    if (!flags.force && !this.shouldOutputJson(flags)) {
      const confirmed = await this.confirmLogout(targetAlias);
      if (!confirmed) {
        this.logWarning("Logout canceled.", flags);
        return;
      }
    }

    // Revoke OAuth tokens if this is an OAuth account
    if (this.configManager.getAuthMethod(targetAlias) === "oauth") {
      const oauthTokens = this.configManager.getOAuthTokens(targetAlias);
      if (oauthTokens) {
        const targetAccount = this.configManager.getCurrentAccount();
        const oauthHost = flags["control-host"] || targetAccount?.controlHost;
        const oauthClient = new OAuthClient({
          controlHost: oauthHost,
        });
        // Best-effort revocation with timeout -- don't block logout
        const revokeWithTimeout = (token: string, timeoutMs = 5000) =>
          Promise.race([
            oauthClient.revokeToken(token),
            new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
          ]);
        await Promise.all([
          revokeWithTimeout(oauthTokens.accessToken),
          revokeWithTimeout(oauthTokens.refreshToken),
        ]).catch((error) => {
          this.logCliEvent(
            flags,
            "accountLogout",
            "revocationFailed",
            `OAuth token revocation failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
      }
    }

    // Remove the account
    const success = this.configManager.removeAccount(targetAlias);

    if (success) {
      // Get remaining accounts for the response
      const remainingAccounts = this.configManager.listAccounts();

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult(
          {
            account: {
              alias: targetAlias,
              remainingAccounts: remainingAccounts.map(
                (account) => account.alias,
              ),
            },
          },
          flags,
        );
      } else {
        // Suggest switching to another account if there are any left
        if (remainingAccounts.length > 0) {
          this.log(
            `Use "ably accounts switch ${remainingAccounts[0]!.alias}" to select another account.`,
          );
        } else {
          this.log(
            'No remaining accounts. Use "ably accounts login" to log in to an account.',
          );
        }
      }

      this.logSuccessMessage(
        `Successfully logged out from account ${targetAlias}.`,
        flags,
      );
    } else {
      this.fail(
        `Failed to log out from account ${targetAlias}.`,
        flags,
        "accountLogout",
      );
    }
  }

  private confirmLogout(alias: string): Promise<boolean> {
    this.log(
      `Warning: Logging out will remove all configuration for account "${alias}".`,
    );
    this.log(
      "This includes access tokens and any app configurations associated with this account.",
    );

    return promptForConfirmation("Are you sure you want to proceed?");
  }
}
