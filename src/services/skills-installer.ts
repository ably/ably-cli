import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DownloadedSkill } from "./skills-downloader.js";

export interface InstallResult {
  target: string;
  name: string;
  directory: string;
  skillCount: number;
  skills: SkillResult[];
}

export interface SkillResult {
  skillName: string;
  status: "installed" | "error";
  error?: string;
}

interface TargetConfig {
  name: string;
  /** Path relative to the user's home directory. */
  relativeDir: string;
}

export const CLAUDE_CODE = "claude-code";

export const TARGET_CONFIGS: Record<string, TargetConfig> = {
  [CLAUDE_CODE]: {
    name: "Claude Code",
    relativeDir: path.join(".claude", "skills"),
  },
  cursor: {
    name: "Cursor",
    relativeDir: path.join(".cursor", "skills"),
  },
  vscode: {
    name: "VS Code",
    relativeDir: path.join(".vscode", "skills"),
  },
  windsurf: {
    name: "Windsurf",
    relativeDir: path.join(".windsurf", "skills"),
  },
};

/**
 * Resolve a target's install directory under the user's home directory.
 * Reads `os.homedir()` lazily so tests can redirect via `HOME`.
 */
export function getTargetDirectory(targetKey: string): string | undefined {
  const config = TARGET_CONFIGS[targetKey];
  if (!config) return undefined;
  return path.join(os.homedir(), config.relativeDir);
}

export class SkillsInstaller {
  install(options: { skills: DownloadedSkill[]; targets: string[] }): {
    results: InstallResult[];
  } {
    const { skills, targets } = options;
    const results: InstallResult[] = [];

    for (const targetKey of targets) {
      const config = TARGET_CONFIGS[targetKey];
      const baseDir = getTargetDirectory(targetKey);
      if (!config || !baseDir) continue;

      const skillResults: SkillResult[] = [];

      for (const skill of skills) {
        const destDir = path.join(baseDir, skill.name);
        skillResults.push(this.installSkill(skill, destDir));
      }

      const installed = skillResults.filter(
        (r) => r.status === "installed",
      ).length;

      results.push({
        target: targetKey,
        name: config.name,
        directory: baseDir,
        skillCount: installed,
        skills: skillResults,
      });
    }

    return { results };
  }

  private installSkill(skill: DownloadedSkill, destDir: string): SkillResult {
    try {
      fs.rmSync(destDir, { recursive: true, force: true });
      fs.mkdirSync(destDir, { recursive: true });
      fs.cpSync(skill.directory, destDir, { recursive: true });
      return { skillName: skill.name, status: "installed" };
    } catch (error) {
      return {
        skillName: skill.name,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static resolveTargets(targets: string[]): string[] {
    if (targets.includes("auto")) {
      return [];
    }
    return targets;
  }
}
