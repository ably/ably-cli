import { execSync } from "node:child_process";
import path from "node:path";

import { Flags } from "@oclif/core";
import chalk from "chalk";

import { AblyBaseCommand } from "../base-command.js";
import { coreGlobalFlags } from "../flags.js";
import {
  runSkillsInstall,
  SkillsInstallOutput,
} from "../services/skills-install-runner.js";
import { TARGET_CONFIGS } from "../services/skills-installer.js";
import { resolveSkillsTargets } from "../services/skills-target-prompt.js";
import { BaseFlags } from "../types/cli.js";
import { displayLogo } from "../utils/logo.js";
import { formatHeading, formatResource } from "../utils/output.js";
import { promptForConfirmation } from "../utils/prompt-confirmation.js";
import isTestMode from "../utils/test-mode.js";

export default class Init extends AblyBaseCommand {
  static override description =
    "Set up Ably for AI-powered development — authenticate and install Agent Skills";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --target claude-code",
    "<%= config.bin %> <%= command.id %> --target cursor --target windsurf",
    "<%= config.bin %> <%= command.id %> --target auto",
    "<%= config.bin %> <%= command.id %> --no-install",
    "<%= config.bin %> <%= command.id %> --json",
  ];

  static override flags = {
    ...coreGlobalFlags,
    target: Flags.string({
      char: "t",
      multiple: true,
      options: ["auto", ...Object.keys(TARGET_CONFIGS)],
      default: ["auto"],
      description: "Target IDE(s) to install skills for",
    }),
    "no-install": Flags.boolean({
      default: false,
      description:
        "Skip installing @ably/cli globally (only relevant when launched via npx)",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);
    const jsonMode = this.shouldOutputJson(flags);

    if (flags.target.includes("auto") && flags.target.length > 1) {
      this.fail(
        new Error(
          "--target auto cannot be combined with explicit targets. Use either auto-detect or named targets, not both.",
        ),
        flags,
        "init",
      );
    }

    if (!jsonMode) {
      displayLogo(this.log.bind(this));
    }

    await this.maybeInstallGlobally(flags);

    await this.runAuth(flags);

    const resolvedTargets = await resolveSkillsTargets({
      flags,
      jsonMode,
      log: this.log.bind(this),
      warn: (msg) => this.logWarning(msg, flags),
      exit: () => this.exit(130),
    });
    if (resolvedTargets === null) {
      if (!jsonMode) this.displayGettingStarted();
      return;
    }

    try {
      await runSkillsInstall(
        { target: resolvedTargets },
        this.buildInstallOutput(flags),
      );
    } catch (error) {
      this.fail(error, flags, "init");
    }

    if (!jsonMode) {
      this.displayGettingStarted();
    }
  }

  private buildInstallOutput(flags: BaseFlags): SkillsInstallOutput {
    return {
      jsonMode: this.shouldOutputJson(flags),
      progress: (msg) => this.logProgress(msg, flags),
      success: (msg) => this.logSuccessMessage(msg, flags),
      warning: (msg) => this.logWarning(msg, flags),
      log: (msg) => this.log(msg),
      emitResult: (data) => this.logJsonResult(data, flags),
    };
  }

  private displayGettingStarted(): void {
    const $ = chalk.green("$");
    const cmd = (s: string) => chalk.cyan(s);
    const note = (s: string) => chalk.dim(s);

    this.log(`${formatHeading("Getting started with the Ably CLI")}\n`);
    this.log(
      "The Ably CLI lets you publish messages, subscribe to channels, manage",
    );
    this.log("apps and keys, and explore Ably from your terminal.\n");

    this.log("Try it — open two terminals and run:");
    this.log(
      `  ${$} ${cmd("ably channels subscribe my-channel")}             ${note("# terminal 1")}`,
    );
    this.log(
      `  ${$} ${cmd('ably channels publish my-channel "hello world"')}  ${note("# terminal 2")}\n`,
    );

    this.log("Useful next steps:");
    this.log(
      `  ${$} ${cmd("ably --help")}              ${note("# browse all commands")}\n`,
    );

    this.log("Docs: https://ably.com/docs/cli\n");
  }

  private async runAuth(flags: BaseFlags): Promise<void> {
    if (this.hasControlApiAccess()) {
      if (!this.shouldOutputJson(flags)) {
        const account = this.configManager.getCurrentAccount();
        const label = account?.accountName
          ? `${account.accountName}${account.accountId ? ` (${account.accountId})` : ""}`
          : "stored credentials";
        this.logSuccessMessage(
          `Already authenticated with ${formatResource(label)}.`,
          flags,
        );
      }
      return;
    }

    if (!this.shouldOutputJson(flags)) {
      this.log(`\n${formatHeading("Authenticate with Ably")}\n`);
    }

    // accounts:login handles JSON mode natively — emitting an
    // awaiting_authorization event with userCode + verificationUri so
    // headless callers can render the device-flow prompt themselves.
    // We pass --skip-logo to avoid printing the Ably ASCII art twice
    // (init already printed it above).
    const loginArgv: string[] = ["--skip-logo"];
    if (flags.json) loginArgv.push("--json");
    else if (flags["pretty-json"]) loginArgv.push("--pretty-json");
    // Suppress accounts:login's terminal {status:"completed"} JSON line so
    // init's own terminator in finally() is the only one in the stream.
    if (flags.json || flags["pretty-json"]) {
      loginArgv.push("--skip-completed-status");
    }

    // Test hook: intercept the accounts:login delegation so unit tests can
    // verify init's unauthenticated branch without spinning up the real
    // OAuth device-code flow. Tests set globalThis.__TEST_MOCKS__.runLogin to
    // a recording function or one that throws.
    const loginRunner =
      isTestMode() && globalThis.__TEST_MOCKS__?.runLogin
        ? (
            globalThis.__TEST_MOCKS__ as {
              runLogin: (argv: string[]) => Promise<void>;
            }
          ).runLogin
        : (argv: string[]) => this.config.runCommand("accounts:login", argv);

    try {
      await loginRunner(loginArgv);
    } catch (error) {
      this.fail(error, flags, "init");
    }
  }

  // Checks for Control API auth (account-level OAuth access token), which is
  // what `accounts:login` provides. Data-plane env vars (ABLY_API_KEY /
  // ABLY_TOKEN) intentionally do NOT count here — they only authenticate the
  // realtime/REST product API and don't grant Control API access (apps, keys,
  // queues, integrations, etc.) that the rest of the CLI relies on.
  private hasControlApiAccess(): boolean {
    if (process.env.ABLY_ACCESS_TOKEN) return true;
    return Boolean(this.configManager.getAccessToken());
  }

  // When invoked via `npx @ably/cli init`, the running binary lives in an
  // ephemeral npx cache that is not on PATH. Without a global install the user
  // can't run `ably` again after init exits — defeating the "one-command
  // onboarding" promise. Detect that situation and offer to install globally.
  private async maybeInstallGlobally(flags: BaseFlags): Promise<void> {
    if (flags["no-install"]) return;
    if (!this.isRunningFromNpx()) return;

    const jsonMode = this.shouldOutputJson(flags);

    if (!jsonMode) {
      const confirmed = await this.confirmGlobalInstall();
      if (!confirmed) {
        this.logWarning(
          "Skipping global install. To install later: npm install -g @ably/cli",
          flags,
        );
        return;
      }
    }

    this.logProgress("Installing @ably/cli globally", flags);
    try {
      await this.runGlobalInstall(jsonMode);
      this.logSuccessMessage("Installed @ably/cli globally.", flags);
    } catch (error) {
      if (jsonMode) {
        // npm output was piped, so the thrown error already carries the
        // captured stderr — surface it so agents see why install failed.
        const detail = error instanceof Error ? error.message : String(error);
        this.logWarning(
          `Could not install @ably/cli globally automatically (${detail}). Run: npm install -g @ably/cli`,
          flags,
        );
      } else {
        // npm output was inherited, so npm has already printed the real error
        // to the user's terminal. error.message is just "Command failed: ..."
        // which adds no information — keep the warning terse.
        this.logWarning(
          "Could not install @ably/cli globally. Run: npm install -g @ably/cli",
          flags,
        );
      }
    }
  }

  private async confirmGlobalInstall(): Promise<boolean> {
    if (isTestMode()) {
      const hook = globalThis.__TEST_MOCKS__?.confirmGlobalInstall;
      if (typeof hook === "boolean") return hook;
    }
    return promptForConfirmation(
      "Install @ably/cli globally so you can run 'ably' from any shell?",
      { defaultYes: true },
    );
  }

  private isRunningFromNpx(): boolean {
    if (isTestMode()) {
      const hook = globalThis.__TEST_MOCKS__?.isRunningFromNpx;
      if (typeof hook === "boolean") return hook;
    }
    const entry = process.argv[1] ?? "";
    return entry.includes(`${path.sep}_npx${path.sep}`);
  }

  // Test hook: when the unit tests set globalThis.__TEST_MOCKS__.installGlobally
  // to a recording or throwing function, use that instead of shelling out to
  // `npm install -g` — which would mutate the developer's machine and require
  // network access during unit tests.
  //
  // In JSON mode we pipe npm's output instead of inheriting so the agent's
  // NDJSON stream isn't polluted with "added N packages" / deprecation
  // warnings. On failure we re-throw with the captured stderr appended so the
  // caller's warning still surfaces the root cause.
  private async runGlobalInstall(jsonMode: boolean): Promise<void> {
    if (isTestMode()) {
      const hook = globalThis.__TEST_MOCKS__?.installGlobally as
        | ((pkg: string) => Promise<void>)
        | undefined;
      if (hook) {
        await hook("@ably/cli@latest");
        return;
      }
    }
    if (jsonMode) {
      try {
        execSync("npm install -g @ably/cli@latest", { stdio: "pipe" });
      } catch (error) {
        const stderr = (
          error as { stderr?: Buffer | string } | undefined
        )?.stderr
          ?.toString()
          .trim();
        const baseMessage =
          error instanceof Error ? error.message : String(error);
        throw new Error(stderr ? `${baseMessage}: ${stderr}` : baseMessage, {
          cause: error,
        });
      }
      return;
    }
    execSync("npm install -g @ably/cli@latest", { stdio: "inherit" });
  }
}
