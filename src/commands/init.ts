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
import isTestMode from "../utils/test-mode.js";

export default class Init extends AblyBaseCommand {
  static override description =
    "Set up Ably for AI-powered development — authenticate and install Agent Skills";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --target claude-code",
    "<%= config.bin %> <%= command.id %> --target cursor --target windsurf",
    "<%= config.bin %> <%= command.id %> --target auto",
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
}
