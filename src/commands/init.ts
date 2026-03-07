import { Command, Flags } from "@oclif/core";
import chalk from "chalk";
import ora from "ora";
import {
  SkillsDownloader,
  DownloadedSkill,
} from "../services/skills-downloader.js";
import {
  SkillsInstaller,
  InstallResult,
  TARGET_CONFIGS,
} from "../services/skills-installer.js";
import { detectTools, DetectedTool } from "../services/tool-detector.js";
import { installClaudePlugin } from "../services/claude-plugin-installer.js";
import { displayLogo } from "../utils/logo.js";

export default class Init extends Command {
  static description =
    "Set up Ably for AI-powered development — authenticates and installs Agent Skills";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --global",
    "<%= config.bin %> <%= command.id %> --target claude-code",
    "<%= config.bin %> <%= command.id %> --skip-auth",
  ];

  static flags = {
    help: Flags.help({ char: "h" }),
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
    // TODO: Replace with "ably/agent-skills" before raising a PR. Using supabase for testing only.
    "skills-repo": Flags.string({
      default: "supabase/agent-skills",
      description: "GitHub repo to fetch skills from",
    }),
  };

  private stepNumber = 0;

  private nextStep(): number {
    this.stepNumber++;
    return this.stepNumber;
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);

    displayLogo(this.log.bind(this));

    // Step 1: Auth (unless skipped)
    if (!flags["skip-auth"]) {
      this.log(
        chalk.bold(`\n  Step ${this.nextStep()}: Authenticate with Ably\n`),
      );
      try {
        await this.config.runCommand("accounts:login", []);
      } catch {
        this.error(
          "Authentication failed. Use --skip-auth if you are already logged in.",
        );
      }
    }

    const isAutoDetect = flags.target.includes("auto");

    // Step: Detect AI coding tools (auto mode)
    let detectedTools: DetectedTool[] = [];
    let fileCopyTargets: string[] = [];

    if (isAutoDetect) {
      this.log(
        chalk.bold(`\n  Step ${this.nextStep()}: Detect AI coding tools\n`),
      );

      const detectSpinner = ora("  Scanning for AI coding tools...").start();
      detectedTools = await detectTools();
      const found = detectedTools.filter((t) => t.detected);
      const notFound = detectedTools.filter((t) => !t.detected);
      detectSpinner.succeed(
        `  Detected ${found.length} AI coding tool${found.length === 1 ? "" : "s"}:`,
      );

      for (const tool of found) {
        const evidenceStr = tool.evidence[0] || "";
        const methodStr =
          tool.installMethod === "plugin" ? "plugin install" : "file copy";
        this.log(
          `    ${chalk.green("●")} ${tool.name.padEnd(15)} ${chalk.dim(`(${evidenceStr})`.padEnd(28))} → ${methodStr}`,
        );
      }

      if (notFound.length > 0) {
        this.log(
          chalk.dim(
            `\n    Not found: ${notFound.map((t) => t.name).join(", ")}`,
          ),
        );
      }

      // Map detected tool IDs to install targets
      // For tools that match a TARGET_CONFIGS key, use that directly
      // "claude-code" with plugin install is handled separately
      fileCopyTargets = found
        .filter((t) => t.installMethod === "file-copy")
        .map((t) => t.id)
        .filter((id) => id in TARGET_CONFIGS);

      if (found.length === 0) {
        this.log(
          chalk.yellow(
            "\n  No AI coding tools detected. Use --target to specify targets manually.",
          ),
        );
        return;
      }
    } else {
      fileCopyTargets = SkillsInstaller.resolveTargets(flags.target);
    }

    const hasClaudePlugin =
      isAutoDetect &&
      detectedTools.some((t) => t.id === "claude-code" && t.detected);

    const downloader = new SkillsDownloader();
    let skills: DownloadedSkill[] = [];

    try {
      // Step: Download skills from GitHub (if file-copy targets exist)
      if (fileCopyTargets.length > 0) {
        skills = await this.downloadSkills(downloader, flags["skills-repo"]);
      }

      // Step: Install skills
      this.log(chalk.bold(`\n  Step ${this.nextStep()}: Install skills\n`));

      const allResults: InstallResult[] = [];

      // Handle Claude Code plugin install
      if (hasClaudePlugin) {
        const pluginSpinner = ora(
          "  Claude Code → installing via plugin system...",
        ).start();
        const pluginResult = await installClaudePlugin(flags["skills-repo"]);

        if (pluginResult.status === "installed") {
          pluginSpinner.succeed(
            "  Claude Code   → installed via plugin system",
          );
        } else if (pluginResult.status === "already-installed") {
          pluginSpinner.succeed(
            "  Claude Code   → already installed (plugin)",
          );
        } else {
          pluginSpinner.warn(
            `  Claude Code   → plugin failed, falling back to file copy`,
          );
          fileCopyTargets.push("claude-code");

          // Download skills if we haven't already
          if (skills.length === 0) {
            skills = await this.downloadSkills(
              downloader,
              flags["skills-repo"],
            );
          }
        }
      }

      // Handle file-copy installs
      if (fileCopyTargets.length > 0 && skills.length > 0) {
        const installer = new SkillsInstaller();
        const results = await installer.install({
          skills,
          global: flags.global,
          targets: fileCopyTargets,
          force: flags.force,
          skillFilter: flags.skill,
          log: this.log.bind(this),
        });
        allResults.push(...results);
      }

      this.displaySummary(allResults, hasClaudePlugin);
    } finally {
      downloader.cleanup();
    }
  }

  private async downloadSkills(
    downloader: SkillsDownloader,
    repo: string,
  ): Promise<DownloadedSkill[]> {
    this.log(
      chalk.bold(`\n  Step ${this.nextStep()}: Download Ably Agent Skills\n`),
    );

    const spinner = ora("  Downloading skills from GitHub...").start();
    try {
      const skills = await downloader.download(repo);
      spinner.succeed(`  Downloaded ${skills.length} skills`);
      return skills;
    } catch (error) {
      spinner.fail("  Failed to download skills");
      this.error(
        error instanceof Error ? error.message : "Failed to download skills",
      );
    }
  }

  private displaySummary(
    results: InstallResult[],
    pluginInstalled: boolean,
  ): void {
    const totalInstalled = results.reduce((sum, r) => sum + r.skillCount, 0);
    const errors = results.flatMap((r) =>
      r.skills.filter((s) => s.status === "error"),
    );

    if (errors.length > 0) {
      this.log(chalk.yellow("\n  Some skills failed to install:"));
      for (const err of errors) {
        this.log(chalk.red(`    ✗ ${err.skillName}: ${err.error}`));
      }
    }

    if (totalInstalled > 0 || pluginInstalled) {
      this.log(
        chalk.green("\n  Done! Restart your IDE to activate Ably skills."),
      );
      this.log(
        chalk.dim(
          "  Your AI assistant now understands Ably SDKs, APIs, and best practices.\n",
        ),
      );
    } else {
      this.log(chalk.dim("\n  No new skills were installed.\n"));
    }
  }
}
