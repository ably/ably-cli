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

export default class EnvCommand extends AblyBaseCommand {
  static override description =
    "Show the reference and usage for environment variables supported by the Ably CLI";

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
    envVarName: Args.string({
      description:
        "Environment variable name (case-insensitive). Run `ably env --list` for the full list.",
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
    const requested = args.envVarName?.toUpperCase();

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
          `Unknown environment variable: ${args.envVarName}. ${hint}`,
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
