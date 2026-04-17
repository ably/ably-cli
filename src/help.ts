import { Command, Help, Config, Interfaces } from "@oclif/core";
import chalk from "chalk";
import stripAnsi from "strip-ansi";

import {
  ConfigManager,
  createConfigManager,
} from "./services/config-manager.js";
import { displayLogo } from "./utils/logo.js";
import { formatReleaseStatus } from "./utils/version.js";

/** Convert camelCase arg name to snake_case so oclif's toUpperCase() produces UPPER_SNAKE_CASE */
function camelToSnake(name: string): string {
  return name.replaceAll(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
}

import {
  WEB_CLI_RESTRICTED_COMMANDS,
  WEB_CLI_ANONYMOUS_RESTRICTED_COMMANDS,
} from "./base-command.js"; // Import the single source of truth
import isWebCliMode from "./utils/web-mode.js";

export default class CustomHelp extends Help {
  static skipCache = true; // For development - prevents help commands from being cached

  protected webCliMode: boolean;
  protected configManager: ConfigManager;
  protected interactiveMode: boolean;
  protected anonymousMode: boolean;
  // Flag to track if we're already showing root help to prevent duplication
  protected isShowingRootHelp: boolean = false;

  constructor(config: Config, opts?: Record<string, unknown>) {
    super(config, opts);
    this.webCliMode = isWebCliMode();
    this.interactiveMode = process.env.ABLY_INTERACTIVE_MODE === "true";
    this.anonymousMode = process.env.ABLY_ANONYMOUS_USER_MODE === "true";
    this.configManager = createConfigManager();
  }

  // Override formatHelpOutput to apply interactive-mode transformations
  formatHelpOutput(output: string): string {
    // Strip "ably" prefix when in interactive mode
    if (this.interactiveMode) {
      output = this.stripAblyPrefix(output);
    }

    return output;
  }

  // Check if ANSI codes should be stripped (oclif readme generation or while generating docs via GENERATING_DOC)
  private shouldStripAnsi(): boolean {
    return !!(this.opts.stripAnsi || process.env.GENERATING_DOC === "true");
  }

  // Helper to strip "ably" prefix from command examples in interactive mode
  private stripAblyPrefix(text: string): string {
    if (!this.interactiveMode) return text;

    // Replace "$ ably " with "ably> " in examples
    text = text.replaceAll("$ ably ", "ably> ");

    // Replace "ably " at the beginning of lines (for usage examples)
    text = text.replaceAll(/^ably /gm, "");

    // Replace "  ably " with "  " (for indented examples)
    text = text.replaceAll(/^(\s+)ably /gm, "$1");

    return text;
  }

  // Helper to ensure no trailing whitespace
  private removeTrailingWhitespace(text: string): string {
    // Remove all trailing newlines completely
    return text.replace(/\n+$/, "");
  }

  // Helper to format COMMANDS section with spaces instead of colons
  private formatCommandsSection(text: string): string {
    // Find the COMMANDS section
    const commandsSectionRegex = /^COMMANDS\s*$/m;
    const commandsMatch = text.match(commandsSectionRegex);

    if (!commandsMatch || commandsMatch.index === undefined) {
      return text;
    }

    // Find where the COMMANDS section starts and ends
    const commandsStart = commandsMatch.index + commandsMatch[0].length;
    const nextSectionMatch = text.slice(commandsStart).match(/^[A-Z]+\s*$/m);
    const commandsEnd = nextSectionMatch
      ? commandsStart + nextSectionMatch.index!
      : text.length;

    // Extract the commands section
    const beforeCommands = text.slice(0, commandsStart);
    const commandsSection = text.slice(commandsStart, commandsEnd);
    const afterCommands = text.slice(commandsEnd);

    // Process each command line in the section
    const processedCommands = commandsSection
      .split("\n")
      .map((line) => {
        // Match lines that look like "  command:subcommand  Description"
        const match = line.match(/^(\s+)([a-z-]+(?::[a-z-]+)+)(\s+.*)$/);
        if (match) {
          const [, indent, commandId, rest] = match;
          // Replace colons with spaces in the command ID
          const formattedId = commandId!.replaceAll(":", " ");
          return indent! + formattedId + rest!;
        }
        return line;
      })
      .join("\n");

    return beforeCommands + processedCommands + afterCommands;
  }

  // Override the display method to clean up trailing whitespace and exit cleanly
  // eslint-disable-next-line @typescript-eslint/require-await -- oclif Help base class requires async
  async showCommandHelp(command: Command.Loadable): Promise<void> {
    // For topic commands, we need to add the COMMANDS section manually
    const output = this.formatCommand(command);
    const cleanedOutput = this.removeTrailingWhitespace(output);
    this.log(this.formatHelpOutput(cleanedOutput));

    // Only exit if not in interactive mode
    if (process.env.ABLY_INTERACTIVE_MODE !== "true") {
      process.exit(0);
    }
  }

  async showHelp(argv: string[]): Promise<void> {
    // Get the help subject which is the last argument that is not a flag
    if (argv.length === 0) {
      return super.showHelp(argv); // No command provided, show general help
    }

    const nonFlagArgs: string[] = [];
    for (const arg of argv) {
      if (arg.startsWith("-")) {
        continue;
      }
      nonFlagArgs.push(arg);
    }
    const subject = nonFlagArgs.join(":");

    const command = this.config.findCommand(subject);
    if (!command) return super.showHelp(argv);

    // Get formatted output
    const output = this.formatCommand(command);
    const cleanedOutput = this.removeTrailingWhitespace(output);
    // Apply stripAnsi when needed
    this.log(this.formatHelpOutput(cleanedOutput));

    // Only exit if not in interactive mode
    if (process.env.ABLY_INTERACTIVE_MODE !== "true") {
      process.exit(0);
    }
  }

  // Override for root help as well
  // eslint-disable-next-line @typescript-eslint/require-await -- oclif Help base class requires async
  async showRootHelp(): Promise<void> {
    // Get formatted output
    const output = this.formatRoot();
    const cleanedOutput = this.removeTrailingWhitespace(output);
    // Apply stripAnsi when needed
    this.log(this.formatHelpOutput(cleanedOutput));

    // Only exit if not in interactive mode
    if (process.env.ABLY_INTERACTIVE_MODE !== "true") {
      process.exit(0);
    }
  }

  formatRoot(): string {
    let output: string;
    // Set flag to indicate we're showing root help
    this.isShowingRootHelp = true;

    const args = process.argv;
    const isWebCliHelp = args.includes("--web-cli-help");

    // Show web CLI help if:
    // 1. We're in web CLI mode and not showing full help AND not in interactive mode
    // 2. OR explicitly requesting web-cli help
    if (
      (this.webCliMode &&
        !args.includes("--help") &&
        !args.includes("-h") &&
        !isWebCliHelp &&
        !this.interactiveMode) ||
      isWebCliHelp
    ) {
      output = this.formatWebCliRoot();
    } else {
      output = this.formatStandardRoot();
    }
    if (this.shouldStripAnsi()) {
      output = stripAnsi(output);
    }
    return output;
  }

  formatStandardRoot(): string {
    // Manually construct root help (bypassing super.formatRoot)
    const { config } = this;
    const lines: string[] = [];

    // 1. Logo (conditionally)
    const logoLines: string[] = [];
    if (process.stdout.isTTY) {
      displayLogo((m: string) => logoLines.push(m)); // Use capture
    }
    lines.push(...logoLines);

    // 2. Title & Usage
    let titleText = "ably.com ";
    if (this.webCliMode) {
      titleText += "browser-based ";
    }
    if (this.interactiveMode) {
      titleText += "interactive ";
    }
    titleText += "CLI for Pub/Sub, Chat and Spaces";

    const headerLines = [
      chalk.bold(titleText),
      "",
      formatReleaseStatus(config.version, true),
      "",
      `${chalk.bold("USAGE")}`,
      `  ${this.interactiveMode ? "ably> " : chalk.green("$") + " " + chalk.cyan(config.bin) + " "}[COMMAND]`,
      "",
      chalk.bold("COMMANDS"), // Use the desired single heading
    ];
    lines.push(...headerLines);

    // 3. Get, filter, combine, sort, and format visible commands/topics
    // Use a Map to ensure unique entries by command/topic name
    const uniqueEntries = new Map<
      string,
      { id: string; description?: string; isCommand: boolean }
    >();

    // Process commands first
    config.commands
      .filter((c) => !c.hidden && !c.id.includes(":")) // Filter hidden and top-level only
      .filter((c) => this.shouldDisplay(c)) // Apply web mode filtering
      .forEach((c) => {
        uniqueEntries.set(c.id, {
          id: c.id,
          description: c.description,
          isCommand: true,
        });
      });

    // Then add topics if they don't already exist as commands
    const filteredTopics = config.topics
      .filter((t) => !t.hidden && !t.name.includes(":")) // Filter hidden and top-level only
      .filter((t) => this.shouldDisplay({ id: t.name } as Command.Loadable)); // Apply web mode filtering

    filteredTopics.forEach((t) => {
      if (!uniqueEntries.has(t.name)) {
        uniqueEntries.set(t.name, {
          id: t.name,
          description: t.description,
          isCommand: false,
        });
      }
    });

    // Convert to array and sort
    const combined = [...uniqueEntries.values()].toSorted((a, b) => {
      return a.id.localeCompare(b.id);
    });

    if (combined.length > 0) {
      const commandListString = this.renderList(
        combined.map((c) => {
          const description =
            c.description && this.render(c.description.split("\n")[0]!);
          const descString = description
            ? chalk.whiteBright(description)
            : undefined;
          return [chalk.cyan(c.id), descString];
        }),
        { indentation: 2, spacer: "\n" }, // Adjust spacing if needed
      );
      lines.push(commandListString);
    } else {
      lines.push("  No commands found.");
    }

    // 4. Login prompt (if needed and not in web mode)
    if (!this.webCliMode) {
      const accessToken =
        process.env.ABLY_ACCESS_TOKEN || this.configManager.getAccessToken();
      const apiKey = process.env.ABLY_API_KEY;
      if (!accessToken && !apiKey) {
        const cmdPrefix = this.interactiveMode ? "" : "ably ";
        lines.push(
          "",
          chalk.yellow(
            "You are not logged in. Run the following command to log in:",
          ),
          chalk.cyan(
            `  ${this.interactiveMode ? "ably> " : "$ "}${cmdPrefix}accounts login`,
          ),
        );
      }
    }

    // Join lines and return
    return lines.join("\n");
  }

  formatWebCliRoot(): string {
    const lines: string[] = [];
    if (process.stdout.isTTY) {
      displayLogo((m: string) => lines.push(m)); // Add logo lines directly
    }
    lines.push(
      chalk.bold("ably.com browser-based CLI for Pub/Sub, Chat and Spaces"),
      "",
      formatReleaseStatus(this.config.version, true),
      "",
    );

    // 3. Show the web CLI specific instructions
    const cmdPrefix = this.interactiveMode ? "" : "ably ";
    lines.push(`${chalk.bold("COMMON COMMANDS")}`);

    const isAnonymousMode = process.env.ABLY_ANONYMOUS_USER_MODE === "true";
    // Basic commands always available
    const commands = [
      [`${cmdPrefix}channels publish [channel] [message]`, "Publish a message"],
      [`${cmdPrefix}channels subscribe [channel]`, "Subscribe to a channel"],
    ];

    // Commands available only for authenticated users
    if (!isAnonymousMode) {
      commands.push(
        [`${cmdPrefix}logs history`, "Retrieve application log history"],
        [`${cmdPrefix}logs subscribe`, "Subscribe to live app logs"],
        [
          `${cmdPrefix}logs channel-lifecycle subscribe`,
          "Stream logs from [meta]channel.lifecycle meta channel",
        ],
        [
          `${cmdPrefix}logs connection-lifecycle subscribe`,
          "Stream logs from [meta]connection.lifecycle meta channel",
        ],
        [
          `${cmdPrefix}logs push subscribe`,
          "Stream logs from the push notifications meta channel [meta]log:push",
        ],
      );
    }

    commands.push(
      [`${cmdPrefix}spaces enter [space]`, "Enter a collaborative space"],
      [
        `${cmdPrefix}rooms messages send [room] [message]`,
        "Send a message to a chat room",
      ],
    );

    // Calculate padding for alignment
    const maxCmdLength = Math.max(...commands.map(([cmd]) => cmd!.length));

    // Display commands with proper alignment
    commands.forEach(([cmd, desc]) => {
      const paddedCmd = cmd!.padEnd(maxCmdLength + 2);
      lines.push(`  ${chalk.cyan(paddedCmd)}${chalk.whiteBright(desc!)}`);
    });

    // Always show help instruction
    lines.push(
      "",
      `Type ${this.interactiveMode ? chalk.cyan("help") : chalk.cyan(`${cmdPrefix}help`)} to see the complete list of commands.`,
      `Use ${this.interactiveMode ? chalk.cyan("--help") : chalk.cyan(`${cmdPrefix}--help`)} with any command for more details.`,
    );

    // Join lines and return
    return lines.join("\n");
  }

  formatCommand(command: Command.Loadable): string {
    let output: string;
    // Reset root help flag when showing individual command help
    this.isShowingRootHelp = false;
    // Capture the original colon-separated command ID before super.formatCommand
    // mutates it (oclif replaces ":" with the topicSeparator, which is " ")
    const originalCommandId = command.id;

    // Temporarily patch arg names: camelCase → snake_case
    // so oclif's toUpperCase() produces UPPER_SNAKE_CASE (e.g., lockId → LOCK_ID)
    const originalArgNames: { arg: { name: string }; name: string }[] = [];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mock/test commands may have undefined args
    for (const arg of Object.values(command.args ?? {})) {
      originalArgNames.push({ arg, name: arg.name });
      arg.name = camelToSnake(arg.name);
    }

    try {
      output = super.formatCommand(command);
    } finally {
      for (const { arg, name } of originalArgNames) {
        arg.name = name;
      }
    }

    // In interactive mode, remove the 'ably' prefix from usage examples
    if (process.env.ABLY_INTERACTIVE_MODE === "true") {
      // Replace '$ ably ' with 'ably> ' in usage and examples
      output = output.replaceAll("$ ably ", "ably> ");
    }

    // Fix COMMANDS section formatting - replace colons with spaces
    output = this.formatCommandsSection(output);

    // For topic commands, add COMMANDS section if it's missing
    const topicPrefix = `${originalCommandId}:`;
    const subcommands = this.config.commands.filter(
      (cmd) =>
        cmd.id.startsWith(topicPrefix) &&
        !cmd.hidden &&
        !cmd.id.slice(topicPrefix.length).includes(":"),
    );

    if (subcommands.length > 0 && !output.includes("COMMANDS")) {
      // Add COMMANDS section for topic commands
      const commandsLines: string[] = [`\n\n${chalk.bold("COMMANDS")}`];

      const entries = subcommands.map((cmd) => {
        const formattedId = cmd.id.replaceAll(":", " ");
        const binPrefix = this.interactiveMode ? "" : `${this.config.bin} `;
        return {
          name: `${binPrefix}${formattedId}`,
          description: cmd.description || "",
        };
      });

      const maxLength = Math.max(...entries.map((e) => e.name.length));

      entries.forEach((entry) => {
        const paddedName = entry.name.padEnd(maxLength + 2);
        commandsLines.push(
          `  ${chalk.cyan(paddedName)}${chalk.whiteBright(entry.description)}`,
        );
      });

      output += commandsLines.join("\n");
    }

    // Modify based on web CLI mode using the imported list
    if (this.webCliMode) {
      const isWebRestricted = WEB_CLI_RESTRICTED_COMMANDS.some((restricted) => {
        // Handle wildcard patterns (e.g., "config*")
        if (restricted.endsWith("*")) {
          const prefix = restricted.slice(0, -1); // Remove the asterisk
          return (
            command.id === prefix ||
            command.id.startsWith(prefix + ":") ||
            command.id.startsWith(prefix)
          );
        }
        // Exact match or command starts with restricted:
        return (
          command.id === restricted || command.id.startsWith(restricted + ":")
        );
      });

      if (isWebRestricted) {
        output = [
          `${chalk.bold("This command is not available in the web CLI mode.")}`,
          "",
          "Please use the standalone CLI installation instead.",
        ].join("\n");
      } else if (this.anonymousMode) {
        // Check anonymous restrictions
        const isAnonymousRestricted =
          WEB_CLI_ANONYMOUS_RESTRICTED_COMMANDS.some((restricted) => {
            // Handle wildcard patterns (e.g., "accounts*", "logs*")
            if (restricted.endsWith("*")) {
              const prefix = restricted.slice(0, -1); // Remove the asterisk
              return (
                command.id === prefix ||
                command.id.startsWith(prefix + ":") ||
                command.id.startsWith(prefix)
              );
            }
            // Exact match or command starts with restricted:
            return (
              command.id === restricted ||
              command.id.startsWith(restricted + ":")
            );
          });

        if (isAnonymousRestricted) {
          output = [
            `${chalk.bold("This command is not available in anonymous mode.")}`,
            "",
            "Please provide an access token to use this command.",
          ].join("\n");
        }
      }
    }
    if (this.shouldStripAnsi()) {
      output = stripAnsi(output);
    }
    return output;
  }

  // Re-add the check for web CLI mode command availability
  shouldDisplay(command: Command.Loadable): boolean {
    if (!this.webCliMode) {
      return true; // Always display if not in web mode
    }

    // In web mode, check if the command should be hidden using the imported list
    // Check if the commandId matches any restricted command pattern
    const isWebRestricted = WEB_CLI_RESTRICTED_COMMANDS.some((restricted) => {
      // Handle wildcard patterns (e.g., "config*")
      if (restricted.endsWith("*")) {
        const prefix = restricted.slice(0, -1); // Remove the asterisk
        return (
          command.id === prefix ||
          command.id.startsWith(prefix + ":") ||
          command.id.startsWith(prefix)
        );
      }
      // Exact match or command starts with restricted:
      return (
        command.id === restricted || command.id.startsWith(restricted + ":")
      );
    });

    if (isWebRestricted) {
      return false;
    }

    // In anonymous mode, also check anonymous restricted commands
    if (this.anonymousMode) {
      const isAnonymousRestricted = WEB_CLI_ANONYMOUS_RESTRICTED_COMMANDS.some(
        (restricted) => {
          // Handle wildcard patterns (e.g., "accounts*", "logs*")
          if (restricted.endsWith("*")) {
            const prefix = restricted.slice(0, -1); // Remove the asterisk
            return (
              command.id === prefix ||
              command.id.startsWith(prefix + ":") ||
              command.id.startsWith(prefix)
            );
          }
          // Exact match or command starts with restricted:
          return (
            command.id === restricted || command.id.startsWith(restricted + ":")
          );
        },
      );

      return !isAnonymousRestricted;
    }

    return true;
  }

  formatCommands(commands: Command.Loadable[]): string {
    // Skip if we're already showing root help to prevent duplication
    if (this.isShowingRootHelp) {
      return "";
    }

    // Filter commands based on webCliMode using shouldDisplay
    const visibleCommands = commands.filter((c) => this.shouldDisplay(c));

    if (visibleCommands.length === 0) return ""; // Return empty if no commands should be shown

    return this.section(
      chalk.bold("COMMANDS"),
      this.renderList(
        visibleCommands.map((c) => {
          const description =
            c.description && this.render(c.description.split("\n")[0]!);
          return [
            chalk.cyan(c.id),
            description ? chalk.whiteBright(description) : undefined,
          ];
        }),
        { indentation: 2 },
      ),
    );
  }

  formatTopics(topics: Interfaces.Topic[]): string {
    // Skip if we're already showing root help to prevent duplication
    if (this.isShowingRootHelp) {
      return "";
    }

    // Filter topics based on webCliMode using shouldDisplay logic
    const visibleTopics = topics.filter((t) => {
      return this.shouldDisplay({ id: t.name } as Command.Loadable);
    });

    if (visibleTopics.length === 0) return "";

    return this.section(
      chalk.bold("TOPICS"),
      topics
        .filter((t) => this.shouldDisplay({ id: t.name } as Command.Loadable)) // Reuse shouldDisplay logic
        .map((c) => {
          const description =
            c.description && this.render(c.description.split("\n")[0]!);
          return [
            chalk.cyan(c.name),
            description ? chalk.whiteBright(description) : undefined,
          ];
        })
        .map(([left, right]) =>
          this.renderList([[left, right]], { indentation: 2 }),
        )
        .join("\n"),
    );
  }
}
