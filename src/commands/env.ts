import { Args } from "@oclif/core";
import pkg from "fast-levenshtein";

import { AblyBaseCommand } from "../base-command.js";
import { ENV_VARS_DATA } from "../data/env-vars.js";
import { coreGlobalFlags } from "../flags.js";
import { BaseFlags } from "../types/cli.js";
import {
  getEnvVarSummaries,
  renderMinimalReference,
  renderSingleVar,
} from "../utils/env-vars-render.js";

const { get: levenshteinDistance } = pkg;

function buildEnvVarArgDescription(): string {
  const summaries = getEnvVarSummaries();
  const maxNameLength = Math.max(...summaries.map((s) => s.name.length));
  const lines = ["Environment variable name. Supported variables:", ""];
  for (const { name, summary } of summaries) {
    lines.push(`${name.padEnd(maxNameLength)}  ${summary}`);
  }
  return lines.join("\n");
}

const ENV_VAR_HELP_EXAMPLES: string[] = [
  ...ENV_VARS_DATA.variables.map((v) => `$ ably env ${v.name}`),
  "$ ably env ABLY_API_KEY --json",
  "$ ably env ABLY_API_KEY --pretty-json",
];

export default class EnvCommand extends AblyBaseCommand {
  static override description =
    "Environment variables for authentication and configuration of default settings\n\nExplicitly set environment variables in your shell, CI/CD, or inline. They are not auto-loaded.";

  static override examples = ENV_VAR_HELP_EXAMPLES;

  static override args = {
    envVarName: Args.string({
      description: buildEnvVarArgDescription(),
      required: false,
    }),
  };

  static override flags = {
    ...coreGlobalFlags,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(EnvCommand);
    const requested = args.envVarName?.toUpperCase();

    if (requested) {
      const match = ENV_VARS_DATA.variables.find((v) => v.name === requested);
      if (!match) {
        const suggestion = this.suggestVarName(requested);
        const hint = suggestion
          ? `Did you mean ${suggestion}? Run \`ably env\` to see all supported variables.`
          : "Run `ably env` to see all supported variables.";
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
