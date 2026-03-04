import { Args, Flags } from "@oclif/core";
import chalk from "chalk";
import * as readline from "node:readline";
import ora from "ora";

import { ControlBaseCommand } from "../../control-base-command.js";
import { ControlApi } from "../../services/control-api.js";
import { OAuthClient, type OAuthTokens } from "../../services/oauth-client.js";
import { BaseFlags } from "../../types/cli.js";
import { displayLogo } from "../../utils/logo.js";
import openUrl from "../../utils/open-url.js";
import { promptForConfirmation } from "../../utils/prompt-confirmation.js";

// Moved function definition outside the class
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
  static override args = {
    token: Args.string({
      description: "Access token (if not provided, will prompt for it)",
      required: false,
    }),
  };

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
    const { args, flags } = await this.parse(AccountsLogin);

    // Display ASCII art logo if not in JSON mode
    if (!this.shouldOutputJson(flags)) {
      displayLogo(this.log.bind(this));
    }

    let accessToken: string;
    let oauthTokens: OAuthTokens | undefined;

    if (args.token) {
      // Direct token provided as argument
      accessToken = args.token;
    } else {
      // OAuth device flow (default)
      oauthTokens = await this.oauthLogin(flags);
      accessToken = oauthTokens.accessToken;
    }

    // If no alias flag provided, prompt the user
    let { alias } = flags;
    if (!alias && !this.shouldOutputJson(flags)) {
      alias = await this.resolveAlias();
    } else if (!alias) {
      alias = "default";
    }

    try {
      // Fetch account information
      const controlApi = new ControlApi({
        accessToken,
        controlHost: flags["control-host"],
      });

      const { account, user } = await controlApi.getMe();

      // Store based on auth method
      if (oauthTokens) {
        this.configManager.storeOAuthTokens(alias, oauthTokens, {
          accountId: account.id,
          accountName: account.name,
        });
      } else {
        this.configManager.storeAccount(accessToken, alias, {
          accountId: account.id,
          accountName: account.name,
          tokenId: "unknown",
          userEmail: user.email,
        });
      }

      // Switch to this account
      this.configManager.switchAccount(alias);

      // Handle app selection based on available apps
      let selectedApp = null;
      let isAutoSelected = false;
      try {
        const apps = await controlApi.listApps();

        if (apps.length === 1) {
          // Auto-select the only app
          selectedApp = apps[0];
          isAutoSelected = true;
          this.configManager.setCurrentApp(selectedApp.id);
          this.configManager.storeAppInfo(selectedApp.id, {
            appName: selectedApp.name,
          });
        } else if (apps.length > 1 && !this.shouldOutputJson(flags)) {
          // Prompt user to select an app when multiple exist
          this.log("\nSelect an app to use:");

          selectedApp = await this.interactiveHelper.selectApp(controlApi);

          if (selectedApp) {
            this.configManager.setCurrentApp(selectedApp.id);
            this.configManager.storeAppInfo(selectedApp.id, {
              appName: selectedApp.name,
            });
          }
        } else if (apps.length === 0 && !this.shouldOutputJson(flags)) {
          // No apps exist - offer to create one
          this.log("\nNo apps found in your account.");

          const shouldCreateApp = await promptForConfirmation(
            "Would you like to create your first app now?",
          );

          if (shouldCreateApp) {
            const appName = await this.promptForAppName();

            try {
              this.log(`\nCreating app "${appName}"...`);

              const app = await controlApi.createApp({
                name: appName,
                tlsOnly: true,
              });

              selectedApp = app;
              isAutoSelected = true;

              this.configManager.setCurrentApp(app.id);
              this.configManager.storeAppInfo(app.id, { appName: app.name });

              this.log(`${chalk.green("\u2713")} App created successfully!`);
            } catch (createError) {
              this.warn(
                `Failed to create app: ${createError instanceof Error ? createError.message : String(createError)}`,
              );
            }
          }
        }
      } catch (error) {
        if (!this.shouldOutputJson(flags)) {
          this.warn(
            `Could not fetch apps: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      // If we have a selected app, also handle API key selection
      let selectedKey = null;
      let isKeyAutoSelected = false;
      if (selectedApp && !this.shouldOutputJson(flags)) {
        try {
          const keys = await controlApi.listKeys(selectedApp.id);

          if (keys.length === 1) {
            selectedKey = keys[0];
            isKeyAutoSelected = true;
            this.configManager.storeAppKey(selectedApp.id, selectedKey.key, {
              keyId: selectedKey.id,
              keyName: selectedKey.name || "Unnamed key",
            });
          } else if (keys.length > 1) {
            this.log("\nSelect an API key to use:");

            selectedKey = await this.interactiveHelper.selectKey(
              controlApi,
              selectedApp.id,
            );

            if (selectedKey) {
              this.configManager.storeAppKey(selectedApp.id, selectedKey.key, {
                keyId: selectedKey.id,
                keyName: selectedKey.name || "Unnamed key",
              });
            }
          }
        } catch (keyError) {
          this.warn(
            `Could not fetch API keys: ${keyError instanceof Error ? keyError.message : String(keyError)}`,
          );
        }
      }

      if (this.shouldOutputJson(flags)) {
        const response: Record<string, unknown> = {
          account: {
            alias,
            id: account.id,
            name: account.name,
            user: { email: user.email },
          },
          authMethod: oauthTokens ? "oauth" : "token",
          success: true,
        };
        if (selectedApp) {
          response.app = {
            autoSelected: isAutoSelected,
            id: selectedApp.id,
            name: selectedApp.name,
          };
          if (selectedKey) {
            response.key = {
              autoSelected: isKeyAutoSelected,
              id: selectedKey.id,
              name: selectedKey.name || "Unnamed key",
            };
          }
        }
        this.log(this.formatJsonOutput(response, flags));
      } else {
        this.log(
          `Successfully logged in to ${chalk.cyan(account.name)} (account ID: ${chalk.greenBright(account.id)})`,
        );
        if (oauthTokens) {
          this.log(`Authenticated via OAuth (token auto-refreshes)`);
        }
        if (alias !== "default") {
          this.log(`Account stored with alias: ${alias}`);
        }

        this.log(`Account ${chalk.cyan(alias)} is now the current account`);

        if (selectedApp) {
          const message = isAutoSelected
            ? `${chalk.green("\u2713")} Automatically selected app: ${chalk.cyan(selectedApp.name)} (${selectedApp.id})`
            : `${chalk.green("\u2713")} Selected app: ${chalk.cyan(selectedApp.name)} (${selectedApp.id})`;
          this.log(message);
        }

        if (selectedKey) {
          const keyMessage = isKeyAutoSelected
            ? `${chalk.green("\u2713")} Automatically selected API key: ${chalk.cyan(selectedKey.name || "Unnamed key")} (${selectedKey.id})`
            : `${chalk.green("\u2713")} Selected API key: ${chalk.cyan(selectedKey.name || "Unnamed key")} (${selectedKey.id})`;
          this.log(keyMessage);
        }
      }
    } catch (error) {
      if (this.shouldOutputJson(flags)) {
        this.jsonError(
          {
            error: error instanceof Error ? error.message : String(error),
            success: false,
          },
          flags,
        );
        return;
      } else {
        this.error(`Failed to authenticate: ${error}`);
      }
    }
  }

  private async oauthLogin(flags: BaseFlags): Promise<OAuthTokens> {
    const oauthClient = new OAuthClient({
      controlHost: flags["control-host"],
    });

    const deviceResponse = await oauthClient.requestDeviceCode();

    if (this.shouldOutputJson(flags)) {
      this.log(
        this.formatJsonOutput(
          {
            status: "awaiting_authorization",
            userCode: deviceResponse.userCode,
            verificationUri: deviceResponse.verificationUri,
            verificationUriComplete: deviceResponse.verificationUriComplete,
          },
          flags,
        ),
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

      spinner?.succeed("Authentication successful!");
      return tokens;
    } catch (error) {
      spinner?.fail("Authentication failed");
      throw error;
    }
  }

  private async resolveAlias(): Promise<string> {
    const accounts = this.configManager.listAccounts();
    const hasDefaultAccount = accounts.some(
      (account) => account.alias === "default",
    );

    if (hasDefaultAccount) {
      this.log("\nYou have not specified an alias for this account.");
      this.log(
        "If you continue without an alias, your existing default account configuration will be overwritten.",
      );
      this.log(
        "To maintain multiple account profiles, please provide an alias.",
      );

      const shouldProvideAlias = await promptForConfirmation(
        "Would you like to provide an alias for this account?",
      );

      if (shouldProvideAlias) {
        return this.promptForAlias();
      }
      this.log(
        "No alias provided. The default account configuration will be overwritten.",
      );
      return "default";
    }

    this.log("\nYou have not specified an alias for this account.");
    this.log(
      "Using an alias allows you to maintain multiple account profiles that you can switch between.",
    );

    const shouldProvideAlias = await promptForConfirmation(
      "Would you like to provide an alias for this account?",
    );

    if (shouldProvideAlias) {
      return this.promptForAlias();
    }
    this.log("No alias provided. This will be set as your default account.");
    return "default";
  }

  private promptForAlias(): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Pass this.log as the logging function to the external validator
    const logFn = this.log.bind(this);

    return new Promise((resolve) => {
      const askForAlias = () => {
        rl.question(
          'Enter an alias for this account (e.g. "dev", "production", "personal"): ',
          (alias) => {
            // Use the external validator function, passing the log function
            const validatedAlias = validateAndGetAlias(alias, logFn);

            if (validatedAlias === null) {
              if (!alias.trim()) {
                logFn("Error: Alias cannot be empty"); // Use logFn here too
              }

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
