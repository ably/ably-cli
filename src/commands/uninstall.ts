import { Command, Flags } from "@oclif/core";
import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import ora from "ora";
import {
  TARGET_CONFIGS,
  SkillsInstaller,
} from "../services/skills-installer.js";
import isTestMode from "../utils/test-mode.js";
import { promptForConfirmation } from "../utils/prompt-confirmation.js";

export default class Uninstall extends Command {
  static description =
    "Remove installed Ably Agent Skills from AI coding tools";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --global",
    "<%= config.bin %> <%= command.id %> --target claude-code",
    "<%= config.bin %> <%= command.id %> --yes",
  ];

  static flags = {
    help: Flags.help({ char: "h" }),
    global: Flags.boolean({
      char: "g",
      default: false,
      description:
        "Remove globally installed skills (~/) instead of project-level",
    }),
    target: Flags.string({
      char: "t",
      multiple: true,
      options: ["claude-code", "cursor", "agents", "all"],
      default: ["all"],
      description: "Target IDE(s) to remove skills from",
    }),
    yes: Flags.boolean({
      char: "y",
      default: false,
      description: "Skip confirmation prompt",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Uninstall);
    const targets = SkillsInstaller.resolveTargets(flags.target);
    const isGlobal = flags.global;

    // Collect directories that exist
    const dirsToRemove: { target: string; name: string; dir: string }[] = [];
    for (const targetKey of targets) {
      const config = TARGET_CONFIGS[targetKey];
      if (!config) continue;

      const dir = isGlobal ? config.globalDir : config.projectDir;
      const resolvedDir = path.resolve(dir);

      if (fs.existsSync(resolvedDir)) {
        dirsToRemove.push({
          target: targetKey,
          name: config.name,
          dir: resolvedDir,
        });
      }
    }

    if (dirsToRemove.length === 0) {
      this.log(chalk.dim("No installed skills found. Nothing to remove."));
      return;
    }

    this.log(chalk.bold("\n  Skills directories to remove:\n"));
    for (const entry of dirsToRemove) {
      const skills = this.listSkills(entry.dir);
      this.log(
        `  ${entry.name.padEnd(12)} → ${chalk.dim(entry.dir)}  (${skills.length} skills)`,
      );
    }
    this.log("");

    if (!flags.yes && !isTestMode()) {
      const confirmed = await promptForConfirmation(
        "  Are you sure you want to remove these skills?",
      );
      if (!confirmed) {
        this.log(chalk.dim("  Cancelled."));
        return;
      }
    }

    for (const entry of dirsToRemove) {
      const spinner = ora(`  Removing ${entry.name} skills...`).start();
      try {
        fs.rmSync(entry.dir, { recursive: true, force: true });
        spinner.succeed(`  ${entry.name.padEnd(12)} → removed`);
      } catch (error) {
        spinner.fail(`  ${entry.name.padEnd(12)} → failed`);
        this.log(
          chalk.red(
            `    ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    }

    this.log(chalk.green("\n  Done! Skills have been removed.\n"));
  }

  private listSkills(dir: string): string[] {
    try {
      return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    } catch {
      return [];
    }
  }
}
