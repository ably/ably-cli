import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import chalk from "chalk";
import ora from "ora";
import { DownloadedSkill } from "./skills-downloader.js";

export interface InstallResult {
  target: string;
  directory: string;
  skillCount: number;
  skills: SkillResult[];
}

export interface SkillResult {
  skillName: string;
  status: "installed" | "updated" | "skipped" | "error";
  error?: string;
}

interface TargetConfig {
  name: string;
  projectDir: string;
  globalDir: string;
}

export const TARGET_CONFIGS: Record<string, TargetConfig> = {
  "claude-code": {
    name: "Claude Code",
    projectDir: ".claude/skills",
    globalDir: path.join(os.homedir(), ".claude", "skills"),
  },
  cursor: {
    name: "Cursor",
    projectDir: ".cursor/skills",
    globalDir: path.join(os.homedir(), ".cursor", "skills"),
  },
  agents: {
    name: "VS Code/etc",
    projectDir: ".agents/skills",
    globalDir: path.join(os.homedir(), ".agents", "skills"),
  },
  vscode: {
    name: "VS Code",
    projectDir: ".vscode/skills",
    globalDir: path.join(os.homedir(), ".vscode", "skills"),
  },
  windsurf: {
    name: "Windsurf",
    projectDir: ".windsurf/skills",
    globalDir: path.join(os.homedir(), ".windsurf", "skills"),
  },
  zed: {
    name: "Zed",
    projectDir: ".zed/skills",
    globalDir: path.join(os.homedir(), ".config", "zed", "skills"),
  },
  continue: {
    name: "Continue.dev",
    projectDir: ".continue/skills",
    globalDir: path.join(os.homedir(), ".continue", "skills"),
  },
};

export class SkillsInstaller {
  async install(options: {
    skills: DownloadedSkill[];
    global: boolean;
    targets: string[];
    force: boolean;
    skillFilter?: string[];
    log: (message: string) => void;
  }): Promise<InstallResult[]> {
    const {
      skills,
      global: isGlobal,
      targets,
      force,
      skillFilter,
      log,
    } = options;
    const results: InstallResult[] = [];

    const filteredSkills = skillFilter
      ? skills.filter((s) => skillFilter.includes(s.name))
      : skills;

    if (skillFilter && filteredSkills.length === 0) {
      throw new Error(
        `No matching skills found. Available: ${skills.map((s) => s.name).join(", ")}`,
      );
    }

    for (const targetKey of targets) {
      const config = TARGET_CONFIGS[targetKey];
      if (!config) continue;

      const baseDir = isGlobal ? config.globalDir : config.projectDir;
      const spinner = ora(`Installing to ${config.name}...`).start();
      const skillResults: SkillResult[] = [];

      for (const skill of filteredSkills) {
        const destDir = path.join(baseDir, skill.name);
        const result = this.installSkill(skill, destDir, force);
        skillResults.push(result);
      }

      const installed = skillResults.filter(
        (r) => r.status === "installed" || r.status === "updated",
      ).length;
      spinner.succeed(
        `${config.name.padEnd(12)} → ${chalk.dim(baseDir + "/")}   (${installed} skills)`,
      );

      results.push({
        target: targetKey,
        directory: baseDir,
        skillCount: installed,
        skills: skillResults,
      });
    }

    const skipped = results.flatMap((r) =>
      r.skills.filter((s) => s.status === "skipped"),
    );
    if (skipped.length > 0) {
      log(
        chalk.dim(
          `\n  ${skipped.length} existing skill(s) skipped. Use --force to overwrite.`,
        ),
      );
    }

    return results;
  }

  private installSkill(
    skill: DownloadedSkill,
    destDir: string,
    force: boolean,
  ): SkillResult {
    try {
      const exists = fs.existsSync(destDir);

      if (exists && !force) {
        return { skillName: skill.name, status: "skipped" };
      }

      if (exists) {
        fs.rmSync(destDir, { recursive: true, force: true });
      }

      fs.mkdirSync(destDir, { recursive: true });
      fs.cpSync(skill.directory, destDir, { recursive: true });

      return {
        skillName: skill.name,
        status: exists ? "updated" : "installed",
      };
    } catch (error) {
      return {
        skillName: skill.name,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static resolveTargets(targets: string[]): string[] {
    if (targets.includes("all")) {
      return Object.keys(TARGET_CONFIGS);
    }
    // "auto" is handled by init.ts via tool detection — treat as empty here
    if (targets.includes("auto")) {
      return [];
    }
    return targets;
  }
}
