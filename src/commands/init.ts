import { Flags } from "@oclif/core";
import { checkbox } from "@inquirer/prompts";
import chalk from "chalk";

import { AblyBaseCommand } from "../base-command.js";
import { coreGlobalFlags } from "../flags.js";
import {
  runSkillsInstall,
  SkillsInstallOutput,
} from "../services/skills-install-runner.js";
import { TARGET_CONFIGS } from "../services/skills-installer.js";
import { detectTools } from "../services/tool-detector.js";
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

    if (!jsonMode) {
      displayLogo(this.log.bind(this));
    }

    await this.runAuth(flags);

    const isAutoDetect = flags.target.includes("auto");
    const isInteractive =
      !jsonMode && Boolean(process.stdout.isTTY && process.stdin.isTTY);

    let resolvedTargets = flags.target;
    if (isAutoDetect && isInteractive) {
      const picked = await this.promptForTargets(flags);
      if (picked === null) {
        this.displayGettingStarted();
        return;
      }
      if (picked.length === 0) {
        this.logWarning(
          "No editors selected — skipping skill installation.",
          flags,
        );
        this.displayGettingStarted();
        return;
      }
      resolvedTargets = picked;
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

  private async promptForTargets(flags: BaseFlags): Promise<string[] | null> {
    this.log(`\n${formatHeading("Detecting AI coding tools")}\n`);

    const detected = await detectTools();
    const choices = detected
      .filter((t) => t.detected && t.id in TARGET_CONFIGS)
      .map((t) => ({
        name: t.name,
        value: t.id,
        checked: true,
      }));

    if (choices.length === 0) {
      this.logWarning(
        "No AI coding tools detected. Use --target to specify editors manually.",
        flags,
      );
      return null;
    }

    // Test hook: short-circuit the interactive prompt so unit tests don't have
    // to drive a real TTY. Tests set globalThis.__TEST_MOCKS__.checkboxResponse
    // to either an array (the picked targets) or "throw" (simulate cancel).
    if (
      isTestMode() &&
      globalThis.__TEST_MOCKS__?.checkboxResponse !== undefined
    ) {
      const response = (
        globalThis.__TEST_MOCKS__ as { checkboxResponse: string[] | "throw" }
      ).checkboxResponse;
      return response === "throw" ? null : response;
    }

    // Take ownership of SIGINT during the prompt: inquirer's signal-exit
    // handler rejects the prompt promise, but Node still tears down the
    // top-level await before our catch runs. By exiting (130) here we make
    // cancellation deterministic and avoid the "unsettled top-level await"
    // warning.
    const onSigint = () => this.exit(130);
    process.once("SIGINT", onSigint);
    try {
      return await checkbox<string>({
        message: "Which editor(s) would you like to configure?",
        choices,
        instructions:
          " (Press <space> to toggle, <a> to toggle all, <enter> to confirm)",
      });
    } catch {
      return null;
    } finally {
      process.removeListener("SIGINT", onSigint);
    }
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
    const loginArgv: string[] = [];
    if (flags.json) loginArgv.push("--json");
    else if (flags["pretty-json"]) loginArgv.push("--pretty-json");

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
