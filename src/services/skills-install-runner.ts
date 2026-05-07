import chalk from "chalk";

import { formatHeading, formatLabel, formatResource } from "../utils/output.js";
import {
  installClaudePlugin,
  PluginInstallStatus,
} from "./claude-plugin-installer.js";
import {
  DownloadedSkill,
  SkillsDownloader,
  SkillsSource,
} from "./skills-downloader.js";
import {
  CLAUDE_CODE,
  InstallResult,
  SkillsInstaller,
  TARGET_CONFIGS,
} from "./skills-installer.js";
import {
  DetectedTool,
  InstallMethod,
  detectTools as runToolDetection,
} from "./tool-detector.js";

export interface SkillsInstallFlags {
  target: string[];
}

export interface SkillsInstallOutput {
  jsonMode: boolean;
  /** Progress note (silent in JSON mode). */
  progress(message: string): void;
  /** Success line (silent in JSON mode, stderr otherwise). */
  success(message: string): void;
  /** Warning (also surfaced as JSON status in JSON mode). */
  warning(message: string): void;
  /** Raw stdout line — used for headings and skill list in non-JSON mode. */
  log(message: string): void;
  /** Final JSON result envelope. */
  emitResult(data: Record<string, unknown>): void;
}

export interface SkillsInstallSummary {
  skills: DownloadedSkill[];
  results: InstallResult[];
  pluginInstalled: boolean;
  detectedTools: DetectedTool[];
  source?: SkillsSource;
}

export async function runSkillsInstall(
  flags: SkillsInstallFlags,
  output: SkillsInstallOutput,
): Promise<SkillsInstallSummary> {
  const isAutoDetect = flags.target.includes("auto");
  // Always run full tool detection so the JSON envelope's
  // `installation.detectedTools` has a stable shape regardless of how the
  // command was invoked. Cost is one cheap probe per supported tool.
  const detectedTools: DetectedTool[] = await detectTargets(output, {
    log: isAutoDetect,
  });
  let fileCopyTargets: string[];

  if (isAutoDetect) {
    const found = detectedTools.filter((t) => t.detected);
    if (found.length === 0) {
      output.warning(
        "No AI coding tools detected. Use --target to specify targets manually.",
      );
      if (output.jsonMode) {
        output.emitResult({
          installation: {
            skills: [],
            installed: [],
            pluginInstalled: false,
            detectedTools,
          },
        });
      }
      return {
        skills: [],
        results: [],
        pluginInstalled: false,
        detectedTools,
      };
    }

    fileCopyTargets = found
      .filter((t) => t.installMethod === InstallMethod.FileCopy)
      .map((t) => t.id)
      .filter((id) => id in TARGET_CONFIGS);
  } else {
    fileCopyTargets = SkillsInstaller.resolveTargets(flags.target);
  }

  const hasClaudePlugin = isAutoDetect
    ? detectedTools.some((t) => t.id === CLAUDE_CODE && t.detected)
    : fileCopyTargets.includes(CLAUDE_CODE) &&
      detectedTools.some((t) => t.id === CLAUDE_CODE && t.detected);

  if (hasClaudePlugin) {
    fileCopyTargets = fileCopyTargets.filter((id) => id !== CLAUDE_CODE);
  }

  const downloader = new SkillsDownloader();
  let skills: DownloadedSkill[] = [];
  let source: SkillsSource | undefined;
  const allResults: InstallResult[] = [];
  let pluginInstalled = false;

  try {
    if (!output.jsonMode && (fileCopyTargets.length > 0 || hasClaudePlugin)) {
      output.log(`\n${formatHeading("Installing skills")}\n`);
    }

    if (fileCopyTargets.length > 0 || hasClaudePlugin) {
      const downloaded = await downloadSkills(downloader, output);
      skills = downloaded.skills;
      source = downloaded.source;
    }

    if (hasClaudePlugin) {
      // `source` is guaranteed set here: the download block above runs
      // whenever `hasClaudePlugin || fileCopyTargets.length > 0`.
      const outcome = await installClaudeCodePlugin(output, source!.sha);
      if (
        outcome === PluginInstallStatus.Installed ||
        outcome === PluginInstallStatus.AlreadyInstalled ||
        outcome === PluginInstallStatus.Partial
      ) {
        pluginInstalled = true;
      } else {
        // Plugin install failed — fall back to file-copy for Claude Code.
        // `skills` is already populated above because hasClaudePlugin was true.
        fileCopyTargets.push(CLAUDE_CODE);
      }
    }

    if (fileCopyTargets.length > 0 && skills.length > 0) {
      const installer = new SkillsInstaller();
      const { results } = installer.install({
        skills,
        targets: fileCopyTargets,
      });

      for (const result of results) {
        output.success(
          `${result.name.padEnd(12)} → ${chalk.dim(result.directory + "/")}`,
        );
      }

      allResults.push(...results);
    }

    if (output.jsonMode) {
      output.emitResult({
        installation: {
          skills: skills.map((s) => ({
            name: s.name,
            description: s.description,
          })),
          installed: allResults,
          pluginInstalled,
          ...(source && { source }),
          detectedTools,
        },
      });
    } else {
      displaySummary(output, allResults, pluginInstalled, skills);
    }

    return {
      skills,
      results: allResults,
      pluginInstalled,
      detectedTools,
      source,
    };
  } finally {
    downloader.cleanup();
  }
}

async function detectTargets(
  output: SkillsInstallOutput,
  opts: { log: boolean } = { log: true },
): Promise<DetectedTool[]> {
  if (opts.log) output.progress("Scanning for AI coding tools");

  const detected = await runToolDetection();

  if (!opts.log || output.jsonMode) return detected;

  const found = detected.filter((t) => t.detected);
  const notFound = detected.filter((t) => !t.detected);

  output.log(
    `\n${formatLabel("Detected")} ${found.length} AI coding tool${found.length === 1 ? "" : "s"}`,
  );
  for (const tool of found) {
    const method =
      tool.installMethod === InstallMethod.Plugin
        ? "plugin install"
        : "file copy";
    output.log(
      `  ${chalk.green("●")} ${formatResource(tool.name.padEnd(15))} ${chalk.dim(`(${tool.evidence})`.padEnd(28))} → ${method}`,
    );
  }
  if (notFound.length > 0) {
    output.log(
      chalk.dim(`\nNot found: ${notFound.map((t) => t.name).join(", ")}`),
    );
  }

  return detected;
}

async function downloadSkills(
  downloader: SkillsDownloader,
  output: SkillsInstallOutput,
): Promise<{ skills: DownloadedSkill[]; source: SkillsSource }> {
  output.progress("Downloading skills from GitHub");
  const result = await downloader.download();
  output.success(
    `Downloaded ${result.skills.length} skills (verified ${result.source.repo}@${result.source.tag}).`,
  );
  return result;
}

async function installClaudeCodePlugin(
  output: SkillsInstallOutput,
  ref: string,
): Promise<PluginInstallStatus> {
  const claude = "Claude Code".padEnd(12);
  output.progress(`${claude} → installing via plugin system`);
  const result = await installClaudePlugin(ref);

  switch (result.status) {
    case PluginInstallStatus.Installed: {
      output.success(`${claude} → installed via plugin system.`);
      break;
    }
    case PluginInstallStatus.AlreadyInstalled: {
      output.success(`${claude} → already installed (plugin).`);
      break;
    }
    case PluginInstallStatus.Partial: {
      const failedNames = result.pluginsFailed.map((p) => p.name).join(", ");
      output.warning(
        `${claude} → installed with errors (failed: ${failedNames}).`,
      );
      for (const failure of result.pluginsFailed) {
        output.warning(`  ${failure.name}: ${failure.error}`);
      }
      break;
    }
    default: {
      output.warning(`${claude} → plugin failed, falling back to file copy.`);
    }
  }

  return result.status;
}

function summarizeDescription(
  description: string | undefined,
  maxWidth: number,
): string {
  if (!description) return "";
  const cleaned = description
    .replace(/^ALWAYS use when /i, "Use when ")
    .replaceAll(/\s+/g, " ")
    .trim();
  const sentenceEnd = cleaned.search(/[.!?](\s|$)/);
  const firstSentence =
    sentenceEnd > 0 ? cleaned.slice(0, sentenceEnd + 1) : cleaned;
  if (firstSentence.length <= maxWidth) return firstSentence;
  return firstSentence.slice(0, Math.max(0, maxWidth - 1)).trimEnd() + "…";
}

function displaySkillList(
  output: SkillsInstallOutput,
  skills: DownloadedSkill[],
): void {
  const nameWidth = Math.max(...skills.map((s) => s.name.length));
  const termWidth = process.stdout.columns || 100;
  const descWidth = Math.max(40, termWidth - nameWidth - 8);

  output.log("");
  for (const skill of skills) {
    const summary = summarizeDescription(skill.description, descWidth);
    const paddedName = formatResource(skill.name.padEnd(nameWidth));
    if (summary) {
      output.log(`${chalk.dim("•")} ${paddedName}  ${chalk.dim(summary)}`);
    } else {
      output.log(`${chalk.dim("•")} ${paddedName}`);
    }
  }
}

function displaySummary(
  output: SkillsInstallOutput,
  results: InstallResult[],
  pluginInstalled: boolean,
  skills: DownloadedSkill[],
): void {
  const totalInstalled = results.reduce((sum, r) => sum + r.skillCount, 0);
  const errors = results.flatMap((r) =>
    r.skills.filter((s) => s.status === "error"),
  );

  if (errors.length > 0) {
    output.warning("Some skills failed to install:");
    for (const err of errors) {
      output.log(`  ${formatResource(err.skillName)}: ${err.error ?? ""}`);
    }
  }

  if (totalInstalled > 0 || pluginInstalled) {
    if (skills.length > 0) {
      output.log(`\n${formatHeading("Installed skills")}`);
      displaySkillList(output, skills);
      output.log("");
    }
    output.success("Done. Restart your IDE to activate Ably skills.");
  } else {
    output.warning("No new skills were installed.");
  }
}
