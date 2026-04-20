import { Flags } from "@oclif/core";
import chalk from "chalk";
import * as readline from "node:readline";
import ora from "ora";

import { ControlBaseCommand } from "../../control-base-command.js";
import { endpointFlag } from "../../flags.js";
import { ControlApi } from "../../services/control-api.js";
import { OAuthClient, type OAuthTokens } from "../../services/oauth-client.js";
import { BaseFlags } from "../../types/cli.js";
import { errorMessage } from "../../utils/errors.js";
import { displayLogo } from "../../utils/logo.js";
import openUrl from "../../utils/open-url.js";
import { formatResource } from "../../utils/output.js";
import { promptForConfirmation } from "../../utils/prompt-confirmation.js";
import { pickUniqueAlias, slugifyAccountName } from "../../utils/slugify.js";

function validateAndGetAlias(
  input: string,
  logFn: (msg: string) => void,
): null | string {
  const trimmedAlias = input.trim();
  if (!trimmedAlias) {
    return null;
  }

  // Convert to lowercase for case-insensitive comparison
  const lowercaseAlias = trimmedAlias.toLowerCase();

  // First character must be a letter
  if (!/^[a-z]/.test(lowercaseAlias)) {
    logFn("Error: Alias must start with a letter");
    return null;
  }

  // Only allow letters, numbers, dashes, and underscores after first character
  if (!/^[a-z][\d_a-z-]*$/.test(lowercaseAlias)) {
    logFn(
      "Error: Alias can only contain letters, numbers, dashes, and underscores",
    );
    return null;
  }

  return lowercaseAlias;
}

export default class AccountsLogin extends ControlBaseCommand {
  static override description = "Log in to your Ably account";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --alias mycompany",
    "<%= config.bin %> <%= command.id %> --no-browser",
    "<%= config.bin %> <%= command.id %> --json",
    "<%= config.bin %> <%= command.id %> --pretty-json",
  ];

  static override flags = {
    ...ControlBaseCommand.globalFlags,
    ...endpointFlag,
    alias: Flags.string({
      char: "a",
      description: "Alias for this account (default account if not specified)",
    }),
    "no-browser": Flags.boolean({
      default: false,
      description: "Do not open a browser",
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(AccountsLogin);

    // Display ASCII art logo if not in JSON mode
    if (!this.shouldOutputJson(flags)) {
      displayLogo(this.log.bind(this));
    }

    let oauthTokens: OAuthTokens;
    try {
      oauthTokens = await this.oauthLogin(flags);
    } catch (error) {
      this.fail(error, flags, "accountLogin");
    }

    const accessToken = oauthTokens.accessToken;

    try {
      // Fetch account information
      const controlApi = new ControlApi({
        accessToken,
        controlHost: flags["control-host"],
      });

      const [{ account: meAccount, user }, accounts] = await Promise.all([
        controlApi.getMe(),
        controlApi.getAccounts(),
      ]);

      let selectedAccountInfo: { id: string; name: string };

      if (accounts.length === 0) {
        // Fallback to /me response if accounts list is empty
        selectedAccountInfo = { id: meAccount.id, name: meAccount.name };
      } else if (accounts.length === 1) {
        selectedAccountInfo = accounts[0]!;
      } else if (accounts.length > 1 && !this.shouldOutputJson(flags)) {
        const picked =
          await this.interactiveHelper.selectAccountFromApi(accounts);
        selectedAccountInfo = picked ?? accounts[0]!;
      } else {
        // Multiple accounts in JSON mode: auto-select the first but surface a
        // warning so scripted callers can detect drift and choose explicitly.
        selectedAccountInfo = accounts[0]!;
        this.logWarning(
          `Multiple accounts found (${accounts.length}); auto-selected ${selectedAccountInfo.name} (${selectedAccountInfo.id}). Run 'ably accounts login' in a terminal to choose, or use --alias to pin a specific account.`,
          flags,
        );
      }

      // Resolve alias AFTER account selection so we can default to account name
      let { alias } = flags;
      if (!alias && !this.shouldOutputJson(flags)) {
        alias = await this.resolveAlias(
          selectedAccountInfo.name,
          selectedAccountInfo.id,
        );
      } else if (!alias) {
        // JSON / non-interactive: auto-suffix on collision with a different
        // account so we never silently rebind an alias that already points
        // somewhere else.
        const picked = pickUniqueAlias(
          slugifyAccountName(selectedAccountInfo.name),
          selectedAccountInfo.id,
          this.configManager.listAccounts(),
        );
        alias = picked.alias;
        if (picked.collidedWith) {
          this.logWarning(
            `Alias "${picked.collidedWith.alias}" is already used by a different account (${picked.collidedWith.accountId}); storing this login as "${alias}" instead.`,
            flags,
          );
        }
      }

      // Store OAuth tokens (include user email from /me response).
      // Pass oauthHost so the session key is scoped per authorization server
      // — otherwise the same email on prod and a review deployment would
      // collide. Also preserve controlHost so later commands talk to the same
      // Control API deployment the user picked at login.
      this.configManager.storeOAuthTokens(
        alias,
        { ...oauthTokens, userEmail: user.email },
        {
          accountId: selectedAccountInfo.id,
          accountName: selectedAccountInfo.name,
          controlHost: flags["control-host"],
          oauthHost: flags["oauth-host"],
        },
      );

      // Switch to this account
      this.configManager.switchAccount(alias);

      // Store custom endpoint if provided
      if (flags.endpoint) {
        this.configManager.storeEndpoint(flags.endpoint);
      }

      // Handle app selection based on available apps
      let selectedApp = null;
      let isAutoSelected = false;
      try {
        const apps = await controlApi.listApps();

        if (apps.length === 1) {
          // Auto-select the only app
          selectedApp = apps[0]!;
          isAutoSelected = true;
          this.configManager.setCurrentApp(selectedApp.id);
          this.configManager.storeAppInfo(selectedApp.id, {
            appName: selectedApp.name,
          });
        } else if (apps.length > 1) {
          if (this.shouldOutputJson(flags)) {
            this.logWarning(
              "Multiple apps found; cannot auto-select in JSON mode. Run 'ably apps switch' in a terminal to choose one.",
              flags,
            );
          } else {
            this.log("\nSelect an app to use:");

            selectedApp = await this.interactiveHelper.selectApp(controlApi);

            if (selectedApp) {
              this.configManager.setCurrentApp(selectedApp.id);
              this.configManager.storeAppInfo(selectedApp.id, {
                appName: selectedApp.name,
              });
            }
          }
        } else if (apps.length === 0) {
          if (this.shouldOutputJson(flags)) {
            this.logWarning(
              "No apps found in this account. Run 'ably apps create' to create one.",
              flags,
            );
          } else {
            this.log("\nNo apps found in your account.");

            const shouldCreateApp = await promptForConfirmation(
              "Would you like to create your first app now?",
            );

            if (shouldCreateApp) {
              const appName = await this.promptForAppName();

              try {
                this.log(""); // blank line before progress
                this.logProgress(
                  `Creating app ${formatResource(appName)}`,
                  flags,
                );

                const app = await controlApi.createApp({
                  name: appName,
                  tlsOnly: true,
                });

                selectedApp = app;
                isAutoSelected = true;

                this.configManager.setCurrentApp(app.id);
                this.configManager.storeAppInfo(app.id, { appName: app.name });

                this.logSuccessMessage("App created successfully.", flags);
              } catch (createError) {
                this.logWarning(
                  `Failed to create app: ${createError instanceof Error ? createError.message : String(createError)}`,
                  flags,
                );
              }
            }
          }
        }
      } catch (error) {
        this.logWarning(`Could not fetch apps: ${errorMessage(error)}`, flags);
      }

      // If we have a selected app, also handle API key selection
      let selectedKey = null;
      let isKeyAutoSelected = false;
      if (selectedApp) {
        try {
          const keys = await controlApi.listKeys(selectedApp.id);

          if (keys.length === 1) {
            // Auto-select the only key (safe in both modes)
            selectedKey = keys[0]!;
            isKeyAutoSelected = true;
            this.configManager.storeAppKey(selectedApp.id, selectedKey.key, {
              keyId: selectedKey.id,
              keyName: selectedKey.name || "Unnamed key",
            });
          } else if (keys.length > 1) {
            if (this.shouldOutputJson(flags)) {
              this.logWarning(
                "Multiple API keys found; cannot auto-select in JSON mode. Run 'ably auth keys switch' in a terminal to choose one.",
                flags,
              );
            } else {
              this.log("\nSelect an API key to use:");

              selectedKey = await this.interactiveHelper.selectKey(
                controlApi,
                selectedApp.id,
              );

              if (selectedKey) {
                this.configManager.storeAppKey(
                  selectedApp.id,
                  selectedKey.key,
                  {
                    keyId: selectedKey.id,
                    keyName: selectedKey.name || "Unnamed key",
                  },
                );
              }
            }
          }
        } catch (keyError) {
          this.logWarning(
            `Could not fetch API keys: ${keyError instanceof Error ? keyError.message : String(keyError)}`,
            flags,
          );
        }
      }

      if (this.shouldOutputJson(flags)) {
        const accountData: {
          alias: string;
          authMethod: "oauth";
          id: string;
          name: string;
          user: { email: string };
          app?: {
            id: string;
            name: string;
            autoSelected: boolean;
          };
          key?: {
            id: string;
            name: string;
            autoSelected: boolean;
          };
        } = {
          alias,
          authMethod: "oauth",
          id: selectedAccountInfo.id,
          name: selectedAccountInfo.name,
          user: {
            email: user.email,
          },
        };
        if (selectedApp) {
          accountData.app = {
            autoSelected: isAutoSelected,
            id: selectedApp.id,
            name: selectedApp.name,
          };
          if (selectedKey) {
            accountData.key = {
              autoSelected: isKeyAutoSelected,
              id: selectedKey.id,
              name: selectedKey.name || "Unnamed key",
            };
          }
        }

        this.logJsonResult({ account: accountData }, flags);
      } else {
        if (alias !== "default") {
          this.log(`Account stored with alias: ${alias}`);
        }

        this.log(`Account ${formatResource(alias)} is now the current account`);
      }

      if (this.shouldOutputJson(flags)) {
        // logJsonResult already emitted above
      } else {
        this.logSuccessMessage(
          `Successfully logged in to ${formatResource(selectedAccountInfo.name)} (account ID: ${formatResource(selectedAccountInfo.id)}).`,
          flags,
        );

        this.logToStderr("Authenticated via OAuth (token auto-refreshes).");

        if (selectedApp) {
          const message = isAutoSelected
            ? `Automatically selected app: ${formatResource(selectedApp.name)} (${selectedApp.id}).`
            : `Selected app: ${formatResource(selectedApp.name)} (${selectedApp.id}).`;
          this.logSuccessMessage(message, flags);
        }

        if (selectedKey) {
          const keyMessage = isKeyAutoSelected
            ? `Automatically selected API key: ${formatResource(selectedKey.name || "Unnamed key")} (${selectedKey.id}).`
            : `Selected API key: ${formatResource(selectedKey.name || "Unnamed key")} (${selectedKey.id}).`;
          this.logSuccessMessage(keyMessage, flags);
        }
      }
    } catch (error) {
      this.fail(error, flags, "accountLogin");
    }
  }

  private async oauthLogin(flags: BaseFlags): Promise<OAuthTokens> {
    const oauthClient = new OAuthClient({
      oauthHost: flags["oauth-host"],
    });

    const deviceResponse = await oauthClient.requestDeviceCode();

    if (this.shouldOutputJson(flags)) {
      this.logJsonEvent(
        {
          status: "awaiting_authorization",
          userCode: deviceResponse.userCode,
          verificationUri: deviceResponse.verificationUri,
          verificationUriComplete: deviceResponse.verificationUriComplete,
        },
        flags,
      );
    } else {
      this.log("");
      this.log(
        `  Your authorization code: ${chalk.bold.cyan(deviceResponse.userCode)}`,
      );
      this.log("");
      this.log(
        `  Visit: ${chalk.underline(deviceResponse.verificationUriComplete)}`,
      );
      this.log("");
    }

    if (!flags["no-browser"]) {
      await openUrl(deviceResponse.verificationUriComplete, this);
    } else if (!this.shouldOutputJson(flags)) {
      this.log("Open the URL above in your browser to authorize.");
    }

    const spinner = this.shouldOutputJson(flags)
      ? undefined
      : ora("Waiting for authorization...").start();

    try {
      const tokens = await oauthClient.pollForToken(
        deviceResponse.deviceCode,
        deviceResponse.interval,
        deviceResponse.expiresIn,
      );

      spinner?.succeed("Authentication successful.");
      return tokens;
    } catch (error) {
      spinner?.fail("Authentication failed.");
      throw error;
    }
  }

  private async resolveAlias(
    accountName: string,
    accountId: string,
  ): Promise<string> {
    const defaultAlias = slugifyAccountName(accountName);
    const existingAccounts = this.configManager.listAccounts();
    const existing = existingAccounts.find((a) => a.alias === defaultAlias);

    // No collision, or the alias already points at the same account
    // (legitimate re-login) — reuse without prompting.
    if (!existing || existing.account.accountId === accountId) {
      return defaultAlias;
    }

    this.log(
      `\nAn account with alias "${defaultAlias}" already exists (account ID: ${existing.account.accountId}) and would be overwritten.`,
    );
    const shouldCustomize = await promptForConfirmation(
      "Would you like to use a different alias?",
    );
    if (shouldCustomize) {
      return this.promptForAlias(defaultAlias);
    }
    return defaultAlias;
  }

  private promptForAlias(defaultAlias: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const logFn = this.log.bind(this);

    return new Promise((resolve) => {
      const askForAlias = () => {
        rl.question(
          `Enter an alias for this account [${defaultAlias}]: `,
          (input) => {
            // Accept default on empty input
            if (!input.trim()) {
              rl.close();
              resolve(defaultAlias);
              return;
            }

            const validatedAlias = validateAndGetAlias(input, logFn);

            if (validatedAlias === null) {
              askForAlias();
            } else {
              rl.close();
              resolve(validatedAlias);
            }
          },
        );
      };

      askForAlias();
    });
  }

  private promptForAppName(): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      const askForAppName = () => {
        rl.question("Enter a name for your app: ", (appName) => {
          const trimmedName = appName.trim();

          if (trimmedName.length === 0) {
            this.log("Error: App name cannot be empty");
            askForAppName();
          } else {
            rl.close();
            resolve(trimmedName);
          }
        });
      };

      askForAppName();
    });
  }
}
