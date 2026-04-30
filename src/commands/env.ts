import { Args, Flags } from "@oclif/core";
import pkg from "fast-levenshtein";

import { AblyBaseCommand } from "../base-command.js";
import { ENV_VARS_DATA } from "../data/env-vars.js";
import { coreGlobalFlags } from "../flags.js";
import { BaseFlags } from "../types/cli.js";
import {
  listVarNames,
  renderMinimalReference,
  renderSingleVar,
} from "../utils/env-vars-render.js";

const { get: levenshteinDistance } = pkg;

const SUPPORTED_VAR_NAMES = ENV_VARS_DATA.variables.map((v) => v.name);

const PREREQUISITES_TEXT = ENV_VARS_DATA.meta.prerequisites
  .map(
    (p) =>
      `- ${p.label} (${p.commands.join(", ")}) authenticate via ${p.authVars.join(" or ")}.`,
  )
  .join("\n");

export default class EnvCommand extends AblyBaseCommand {
  static override description =
    "Show the reference for environment variables supported by the Ably CLI\n\n" +
    "The Ably CLI supports environment variables for authentication. These are useful in scripts, CI/CD pipelines, and automated workflows where interactive login is not possible. When any of these variables are set, the CLI bypasses the `ably login` workflow entirely.\n\n" +
    `Prerequisites:\n${PREREQUISITES_TEXT}\n\n` +
    "Run without arguments for an overview of all variables with examples, or pass a variable name for the full per-variable reference.";

  static override examples = [
    {
      description:
        "List all supported variable names, one per line (pipe-friendly)",
      command: "<%= config.bin %> <%= command.id %> --list",
    },
    {
      description:
        "Display the reference and usage examples for `ABLY_API_KEY`",
      command: "<%= config.bin %> <%= command.id %> ABLY_API_KEY",
    },
    {
      description:
        "Display the reference and usage examples for `ABLY_TOKEN` (highest auth priority)",
      command: "<%= config.bin %> <%= command.id %> ABLY_TOKEN",
    },
    {
      description:
        "Display the reference and usage examples for `ABLY_ACCESS_TOKEN`",
      command: "<%= config.bin %> <%= command.id %> ABLY_ACCESS_TOKEN",
    },
    {
      description:
        "Display the reference and usage examples for `ABLY_ENDPOINT` (Realtime/REST API endpoint override)",
      command: "<%= config.bin %> <%= command.id %> ABLY_ENDPOINT",
    },
    {
      description:
        "Display the reference for `ABLY_API_KEY` in JSON format (machine-readable, useful in scripts)",
      command: "<%= config.bin %> <%= command.id %> ABLY_API_KEY --json",
    },
  ];

  static override args = {
    varName: Args.string({
      description: `Name of an environment variable (case-insensitive). One of: ${SUPPORTED_VAR_NAMES.join(", ")}. Omit to print the overview with examples.`,
      required: false,
    }),
  };

  static override flags = {
    ...coreGlobalFlags,
    list: Flags.boolean({
      description: "Print only variable names, one per line; useful for piping",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(EnvCommand);
    const requested = args.varName?.toUpperCase();

    if (flags.list && requested) {
      this.fail(
        "Pass either --list or a variable name, not both. Use --list for the names, or `ably env <NAME>` for one variable.",
        flags as BaseFlags,
        "env",
      );
    }

    if (flags.list) {
      if (this.shouldOutputJson(flags)) {
        this.logJsonResult({ envVarNames: listVarNames() }, flags as BaseFlags);
        return;
      }
      for (const name of listVarNames()) this.log(name);
      return;
    }

    if (requested) {
      const match = ENV_VARS_DATA.variables.find((v) => v.name === requested);
      if (!match) {
        const suggestion = this.suggestVarName(requested);
        const hint = suggestion
          ? `Did you mean ${suggestion}? Run \`ably env --list\` to see all supported variables.`
          : "Run `ably env --list` to see all supported variables.";
        this.fail(
          `Unknown environment variable: ${args.varName}. ${hint}`,
          flags as BaseFlags,
          "env",
        );
      }

      if (this.shouldOutputJson(flags)) {
        this.logJsonResult({ envVar: match }, flags as BaseFlags);
        return;
      }

      this.log(renderSingleVar(match.name));
      return;
    }

    if (this.shouldOutputJson(flags)) {
      this.logJsonResult(
        {
          envVars: ENV_VARS_DATA.variables,
          crossCutting: ENV_VARS_DATA.crossCutting,
          relatedLinks: ENV_VARS_DATA.relatedLinks,
        },
        flags as BaseFlags,
      );
      return;
    }

    this.log(renderMinimalReference());
  }

  private suggestVarName(input: string): string | undefined {
    const threshold = Math.min(Math.max(1, Math.floor(input.length / 2)), 3);
    let best: { name: string; distance: number } | undefined;
    for (const v of ENV_VARS_DATA.variables) {
      const distance = levenshteinDistance(input, v.name, {
        useCollator: true,
      });
      if (!best || distance < best.distance) {
        best = { name: v.name, distance };
      }
    }
    return best && best.distance <= threshold ? best.name : undefined;
  }
}
