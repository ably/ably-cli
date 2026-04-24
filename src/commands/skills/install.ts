import { Flags } from "@oclif/core";
import chalk from "chalk";
import ora from "ora";

import { AblyBaseCommand } from "../../base-command.js";
import { coreGlobalFlags } from "../../flags.js";
import { installClaudePlugin } from "../../services/claude-plugin-installer.js";
import {
  DownloadedSkill,
  SkillsDownloader,
} from "../../services/skills-downloader.js";
import {
  InstallResult,
  SkillsInstaller,
  TARGET_CONFIGS,
} from "../../services/skills-installer.js";
import { DetectedTool, detectTools } from "../../services/tool-detector.js";
import { BaseFlags } from "../../types/cli.js";
import { formatLabel, formatResource } from "../../utils/output.js";

export default class SkillsInstall extends AblyBaseCommand {
  static override description =
    "Install Ably Agent Skills into AI coding tools";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --global",
    "<%= config.bin %> <%= command.id %> --target claude-code",
    "<%= config.bin %> <%= command.id %> --json",
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
    const { flags } = await this.parse(SkillsInstall);
    const jsonMode = this.shouldOutputJson(flags);

    const isAutoDetect = flags.target.includes("auto");
    let detectedTools: DetectedTool[] = [];
    let fileCopyTargets: string[];

    if (isAutoDetect) {
      detectedTools = await this.detectTools(flags);

      const found = detectedTools.filter((t) => t.detected);
      if (found.length === 0) {
        this.logWarning(
          "No AI coding tools detected. Use --target to specify targets manually.",
          flags,
        );
        if (jsonMode) {
          this.logJsonResult(
            {
              detectedTools,
              installed: [],
              pluginInstalled: false,
            },
            flags,
          );
        }
        return;
      }

      fileCopyTargets = found
        .filter((t) => t.installMethod === "file-copy")
        .map((t) => t.id)
        .filter((id) => id in TARGET_CONFIGS);
    } else {
      fileCopyTargets = SkillsInstaller.resolveTargets(flags.target);
    }

    const hasClaudePlugin =
      isAutoDetect &&
      detectedTools.some((t) => t.id === "claude-code" && t.detected);

    const downloader = new SkillsDownloader();
    let skills: DownloadedSkill[] = [];
    const allResults: InstallResult[] = [];
    let pluginInstalled = false;

    try {
      if (fileCopyTargets.length > 0) {
        skills = await this.downloadSkills(downloader, flags);
      }

      if (!jsonMode) {
        this.log(chalk.bold("\n  Installing skills\n"));
      }

      if (hasClaudePlugin) {
        const outcome = await this.installClaudeCodePlugin(flags);
        if (outcome === "installed" || outcome === "already-installed") {
          pluginInstalled = true;
        } else {
          fileCopyTargets.push("claude-code");
          if (skills.length === 0) {
            skills = await this.downloadSkills(downloader, flags);
          }
        }
      }

      if (fileCopyTargets.length > 0 && skills.length > 0) {
        const installer = new SkillsInstaller();
        const { results, skippedCount } = installer.install({
          skills,
          global: flags.global,
          targets: fileCopyTargets,
          force: flags.force,
          skillFilter: flags.skill,
        });

        for (const result of results) {
          if (!jsonMode) {
            this.log(
              `  ${result.name.padEnd(12)} → ${chalk.dim(result.directory + "/")}   (${result.skillCount} skills)`,
            );
          }
        }

        if (skippedCount > 0 && !jsonMode) {
          this.logWarning(
            `${skippedCount} existing skill(s) skipped. Use --force to overwrite.`,
            flags,
          );
        }

        allResults.push(...results);
      }

      if (jsonMode) {
        this.logJsonResult(
          {
            installed: allResults,
            pluginInstalled,
            ...(isAutoDetect && { detectedTools }),
          },
          flags,
        );
      } else {
        this.displaySummary(flags, allResults, pluginInstalled);
      }
    } catch (error) {
      this.fail(error, flags, "skillsInstall");
    } finally {
      downloader.cleanup();
    }
  }

  private async detectTools(flags: BaseFlags): Promise<DetectedTool[]> {
    this.logProgress("Scanning for AI coding tools", flags);

    const detected = await detectTools();
    const found = detected.filter((t) => t.detected);
    const notFound = detected.filter((t) => !t.detected);

    if (!this.shouldOutputJson(flags)) {
      this.log(
        `\n  ${formatLabel("Detected")} ${found.length} AI coding tool${found.length === 1 ? "" : "s"}`,
      );
      for (const tool of found) {
        const evidence = tool.evidence[0] || "";
        const method =
          tool.installMethod === "plugin" ? "plugin install" : "file copy";
        this.log(
          `    ${chalk.green("●")} ${formatResource(tool.name.padEnd(15))} ${chalk.dim(`(${evidence})`.padEnd(28))} → ${method}`,
        );
      }
      if (notFound.length > 0) {
        this.log(
          chalk.dim(
            `\n    Not found: ${notFound.map((t) => t.name).join(", ")}`,
          ),
        );
      }
    }

    return detected;
  }

  private async downloadSkills(
    downloader: SkillsDownloader,
    flags: BaseFlags & { "skills-repo": string },
  ): Promise<DownloadedSkill[]> {
    const useSpinner = this.shouldUseTerminalUpdates();
    const spinner = useSpinner
      ? ora("  Downloading skills from GitHub...").start()
      : null;

    if (!useSpinner) {
      this.logProgress("Downloading skills from GitHub", flags);
    }

    try {
      const skills = await downloader.download(flags["skills-repo"]);
      if (spinner) {
        spinner.succeed(`  Downloaded ${skills.length} skills`);
      } else {
        this.logSuccessMessage(`Downloaded ${skills.length} skills.`, flags);
      }
      return skills;
    } catch (error) {
      if (spinner) spinner.fail("  Failed to download skills");
      throw error instanceof Error
        ? error
        : new Error("Failed to download skills");
    }
  }

  private async installClaudeCodePlugin(
    flags: BaseFlags & { "skills-repo": string },
  ): Promise<"installed" | "already-installed" | "error"> {
    const useSpinner = this.shouldUseTerminalUpdates();
    const spinner = useSpinner
      ? ora("  Claude Code → installing via plugin system...").start()
      : null;

    if (!useSpinner) {
      this.logProgress("Claude Code → installing via plugin system", flags);
    }

    const result = await installClaudePlugin(flags["skills-repo"]);

    if (result.status === "installed") {
      if (spinner) {
        spinner.succeed("  Claude Code   → installed via plugin system");
      } else {
        this.logSuccessMessage(
          "Claude Code installed via plugin system.",
          flags,
        );
      }
    } else if (result.status === "already-installed") {
      if (spinner) {
        spinner.succeed("  Claude Code   → already installed (plugin)");
      } else {
        this.logSuccessMessage(
          "Claude Code already installed via plugin.",
          flags,
        );
      }
    } else if (spinner) {
      spinner.warn(
        "  Claude Code   → plugin failed, falling back to file copy",
      );
    } else {
      this.logWarning(
        "Claude Code plugin install failed — falling back to file copy.",
        flags,
      );
    }

    return result.status;
  }

  private displaySummary(
    flags: BaseFlags,
    results: InstallResult[],
    pluginInstalled: boolean,
  ): void {
    const totalInstalled = results.reduce((sum, r) => sum + r.skillCount, 0);
    const errors = results.flatMap((r) =>
      r.skills.filter((s) => s.status === "error"),
    );

    if (errors.length > 0) {
      this.logWarning("Some skills failed to install:", flags);
      for (const err of errors) {
        this.log(`    ${formatResource(err.skillName)}: ${err.error ?? ""}`);
      }
    }

    if (totalInstalled > 0 || pluginInstalled) {
      this.logSuccessMessage(
        "Done. Restart your IDE to activate Ably skills.",
        flags,
      );
      this.log(
        chalk.dim(
          "  Your AI assistant now understands Ably SDKs, APIs, and best practices.\n",
        ),
      );
    } else {
      this.logWarning("No new skills were installed.", flags);
    }
  }
}
