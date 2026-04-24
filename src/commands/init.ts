import { Flags } from "@oclif/core";
import chalk from "chalk";

import { AblyBaseCommand } from "../base-command.js";
import { coreGlobalFlags } from "../flags.js";
import { TARGET_CONFIGS } from "../services/skills-installer.js";
import { BaseFlags } from "../types/cli.js";
import { displayLogo } from "../utils/logo.js";

export default class Init extends AblyBaseCommand {
  static override description =
    "Set up Ably for AI-powered development — authenticate and install Agent Skills";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --global",
    "<%= config.bin %> <%= command.id %> --target claude-code",
    "<%= config.bin %> <%= command.id %> --skip-auth",
    "<%= config.bin %> <%= command.id %> --skip-auth --json",
  ];

  static override flags = {
    ...coreGlobalFlags,
    global: Flags.boolean({
      char: "g",
      default: false,
      description: "Install skills globally (~/) instead of project-level",
    }),
    target: Flags.string({
      char: "t",
      multiple: true,
      options: ["auto", ...Object.keys(TARGET_CONFIGS), "all"],
      default: ["auto"],
      description: "Target IDE(s) to install skills for",
    }),
    force: Flags.boolean({
      char: "f",
      default: false,
      description: "Overwrite existing skills without prompting",
    }),
    "skip-auth": Flags.boolean({
      default: false,
      description: "Skip authentication step",
    }),
    skill: Flags.string({
      char: "s",
      multiple: true,
      description: "Install only specific skill(s) by name",
    }),
    "skills-repo": Flags.string({
      default: "ably/agent-skills",
      description: "GitHub repo to fetch skills from",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);
    const jsonMode = this.shouldOutputJson(flags);

    if (!jsonMode) {
      displayLogo(this.log.bind(this));
    }

    await this.runAuth(flags);
    await this.config.runCommand(
      "skills:install",
      this.buildInstallArgv(flags),
    );
  }

  private async runAuth(
    flags: BaseFlags & { "skip-auth": boolean },
  ): Promise<void> {
    if (flags["skip-auth"]) return;

    if (this.shouldOutputJson(flags)) {
      this.fail(
        "Authentication cannot run in --json mode. Use --skip-auth or set ABLY_ACCESS_TOKEN.",
        flags,
        "init",
      );
    }

    this.log(chalk.bold("\n  Authenticate with Ably\n"));
    try {
      await this.config.runCommand("accounts:login", []);
    } catch {
      this.fail(
        "Authentication failed. Use --skip-auth if you are already logged in.",
        flags,
        "init",
      );
    }
  }

  private buildInstallArgv(
    flags: BaseFlags & {
      global: boolean;
      target: string[];
      force: boolean;
      skill?: string[];
      "skills-repo": string;
    },
  ): string[] {
    const argv: string[] = [];

    if (flags.global) argv.push("--global");
    for (const target of flags.target) argv.push("--target", target);
    if (flags.force) argv.push("--force");
    if (flags.skill) {
      for (const skill of flags.skill) argv.push("--skill", skill);
    }
    argv.push("--skills-repo", flags["skills-repo"]);

    if (flags.json) argv.push("--json");
    else if (flags["pretty-json"]) argv.push("--pretty-json");
    if (flags.verbose) argv.push("--verbose");

    return argv;
  }
}
