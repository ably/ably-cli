import { Command, Flags } from "@oclif/core";
import chalk from "chalk";
import ora from "ora";
import { SkillsDownloader } from "../services/skills-downloader.js";
import {
  SkillsInstaller,
  InstallResult,
} from "../services/skills-installer.js";
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
      options: ["claude-code", "cursor", "agents", "all"],
      default: ["all"],
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
    // TODO: Replace with "ably/agent-skills" before raising a PR. Using vercel-labs for testing only.
    "skills-repo": Flags.string({
      default: "vercel-labs/agent-skills",
      description: "GitHub repo to fetch skills from",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);

    displayLogo(this.log.bind(this));

    // Step 1: Auth (unless skipped)
    if (!flags["skip-auth"]) {
      this.log(chalk.bold("\n  Step 1: Authenticate with Ably\n"));
      try {
        await this.config.runCommand("accounts:login", []);
      } catch {
        this.error(
          "Authentication failed. Use --skip-auth if you are already logged in.",
        );
      }
    }

    // Step 2: Download skills from GitHub
    this.log(
      chalk.bold(
        `\n  Step ${flags["skip-auth"] ? "1" : "2"}: Download Ably Agent Skills\n`,
      ),
    );

    const downloader = new SkillsDownloader();
    const downloadSpinner = ora("  Downloading skills from GitHub...").start();

    let skills;
    try {
      skills = await downloader.download(flags["skills-repo"]);
      downloadSpinner.succeed(`  Downloaded ${skills.length} skills`);
    } catch (error) {
      downloadSpinner.fail("  Failed to download skills");
      downloader.cleanup();
      this.error(
        error instanceof Error ? error.message : "Failed to download skills",
      );
    }

    // Step 3: Install to IDE directories
    this.log(
      chalk.bold(
        `\n  Step ${flags["skip-auth"] ? "2" : "3"}: Install skills for AI coding tools\n`,
      ),
    );

    const installer = new SkillsInstaller();
    const targets = SkillsInstaller.resolveTargets(flags.target);

    let results: InstallResult[];
    try {
      results = await installer.install({
        skills,
        global: flags.global,
        targets,
        force: flags.force,
        skillFilter: flags.skill,
        log: this.log.bind(this),
      });
    } catch (error) {
      downloader.cleanup();
      this.error(
        error instanceof Error ? error.message : "Failed to install skills",
      );
    }

    downloader.cleanup();

    this.displaySummary(results);
  }

  private displaySummary(results: InstallResult[]): void {
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

    if (totalInstalled > 0) {
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
