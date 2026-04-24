import { Args } from "@oclif/core";

import { ControlBaseCommand } from "../../control-base-command.js";
import { forceFlag } from "../../flags.js";
import { promptForConfirmation } from "../../utils/prompt-confirmation.js";

export default class AccountsLogout extends ControlBaseCommand {
  static override args = {
    accountAliasOrId: Args.string({
      description:
        "Alias or ID of the account to log out from (defaults to current account)",
      required: false,
    }),
  };

  static override description = "Log out from an Ably account";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> mycompany",
    "<%= config.bin %> <%= command.id %> VgQpOZ",
    "<%= config.bin %> <%= command.id %> --json",
    "<%= config.bin %> <%= command.id %> --pretty-json",
  ];

  static override flags = {
    ...ControlBaseCommand.globalFlags,
    ...forceFlag,
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(AccountsLogout);

    // Determine which account to log out from. The accountAliasOrId arg
    // accepts two formats:
    //   1. Account alias  — e.g. "mycompany" (the label set during login)
    //   2. Account ID     — e.g. "VgQpOZ"    (the Ably-assigned account ID)
    //
    // Resolution is handled by resolveAccountAlias() which matches alias
    // first, then accountId. When omitted, the current account is used.
    let targetAlias: string;
    if (args.accountAliasOrId) {
      targetAlias = this.resolveAccountAlias(args.accountAliasOrId, flags);
    } else {
      const currentAlias = this.configManager.getCurrentAccountAlias();
      if (!currentAlias) {
        this.fail(
          'No account is currently selected and no alias or ID provided. Use "ably accounts list" to see available accounts.',
          flags,
          "accountLogout",
        );
      }
      // Validate that the current alias still exists in the accounts list.
      // This catches stale config where current.account points to a removed alias.
      targetAlias = this.resolveAccountAlias(currentAlias, flags);
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
