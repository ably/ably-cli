import { Flags } from "@oclif/core";
import fs from "node:fs";
import path from "node:path";

import { AblyBaseCommand } from "../../base-command.js";
import { coreGlobalFlags, forceFlag } from "../../flags.js";
import {
  SkillsInstaller,
  TARGET_CONFIGS,
} from "../../services/skills-installer.js";
import { BaseFlags } from "../../types/cli.js";
import { formatLabel, formatResource } from "../../utils/output.js";
import { promptForConfirmation } from "../../utils/prompt-confirmation.js";
import isTestMode from "../../utils/test-mode.js";

interface RemovalTarget {
  target: string;
  name: string;
  dir: string;
  skills: string[];
}

interface RemovalResult {
  target: string;
  name: string;
  directory: string;
  removed: boolean;
  error?: string;
}

export default class SkillsUninstall extends AblyBaseCommand {
  static override description =
    "Remove installed Ably Agent Skills from AI coding tools";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --global",
    "<%= config.bin %> <%= command.id %> --target claude-code",
    "<%= config.bin %> <%= command.id %> --force",
    "<%= config.bin %> <%= command.id %> --force --json",
  ];

  static override flags = {
    ...coreGlobalFlags,
    ...forceFlag,
    global: Flags.boolean({
      char: "g",
      default: false,
      description:
        "Remove globally installed skills (~/) instead of project-level",
    }),
    target: Flags.string({
      char: "t",
      multiple: true,
      options: [...Object.keys(TARGET_CONFIGS), "all"],
      default: ["all"],
      description: "Target IDE(s) to remove skills from",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(SkillsUninstall);
    const jsonMode = this.shouldOutputJson(flags);

    const targets = SkillsInstaller.resolveTargets(flags.target);
    const dirsToRemove = this.collectTargets(targets, flags.global);

    if (dirsToRemove.length === 0) {
      if (jsonMode) {
        this.logJsonResult({ removed: [] }, flags);
      } else {
        this.logWarning("No installed skills found. Nothing to remove.", flags);
      }
      return;
    }

    if (!jsonMode) {
      this.log("\n  Skills directories to remove:\n");
      for (const entry of dirsToRemove) {
        this.log(
          `  ${formatLabel(entry.name.padEnd(12))} ${formatResource(entry.dir)}  (${entry.skills.length} skills)`,
        );
      }
      this.log("");
    }

    if (!flags.force && jsonMode) {
      this.fail(
        "The --force flag is required when using --json to confirm removal.",
        flags,
        "skillsUninstall",
      );
    }

    if (!flags.force && !isTestMode()) {
      const confirmed = await promptForConfirmation(
        "  Are you sure you want to remove these skills?",
      );
      if (!confirmed) {
        this.logWarning("Cancelled.", flags);
        return;
      }
    }

    const results = this.removeAll(flags, dirsToRemove);

    if (jsonMode) {
      this.logJsonResult({ removed: results }, flags);
      return;
    }

    const succeeded = results.filter((r) => r.removed).length;
    if (succeeded === results.length) {
      this.logSuccessMessage("Skills have been removed.", flags);
    } else {
      this.logWarning(
        `Removed ${succeeded} of ${results.length} target directories.`,
        flags,
      );
    }
  }

  private collectTargets(
    targets: string[],
    isGlobal: boolean,
  ): RemovalTarget[] {
    const result: RemovalTarget[] = [];
    for (const targetKey of targets) {
      const config = TARGET_CONFIGS[targetKey];
      if (!config) continue;

      const dir = path.resolve(isGlobal ? config.globalDir : config.projectDir);
      if (!fs.existsSync(dir)) continue;

      result.push({
        target: targetKey,
        name: config.name,
        dir,
        skills: this.listSkills(dir),
      });
    }
    return result;
  }

  private removeAll(
    flags: BaseFlags,
    dirsToRemove: RemovalTarget[],
  ): RemovalResult[] {
    const results: RemovalResult[] = [];
    for (const entry of dirsToRemove) {
      try {
        fs.rmSync(entry.dir, { recursive: true, force: true });
        if (!this.shouldOutputJson(flags)) {
          this.logSuccessMessage(`${entry.name} skills removed.`, flags);
        }
        results.push({
          target: entry.target,
          name: entry.name,
          directory: entry.dir,
          removed: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logWarning(
          `Failed to remove ${entry.name} skills: ${message}`,
          flags,
        );
        results.push({
          target: entry.target,
          name: entry.name,
          directory: entry.dir,
          removed: false,
          error: message,
        });
      }
    }
    return results;
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
