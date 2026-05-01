import chalk from "chalk";
import Table from "cli-table3";

import {
  type Block,
  type DetailSection,
  type EnvVarEntry,
  ENV_VARS_DATA,
} from "../data/env-vars.js";

const c = {
  code: (s: string) => chalk.cyan(s),
  bold: (s: string) => chalk.bold(s),
  dim: (s: string) => chalk.dim(s),
  heading: (s: string) => chalk.bold.underline(s),
  category: (s: string) => chalk.bold(s),
  varHeading: (s: string) => chalk.bold.cyan(s),
  callout: {
    note: (s: string) => `${chalk.yellow("⚠")} ${s}`,
    important: (s: string) => `${chalk.red("!")} ${s}`,
  },
  bullet: (s: string) => `  • ${s}`,
  numbered: (n: number, s: string) => `  ${n}. ${s}`,
};

const BORDERLESS_TABLE_CHARS = {
  top: "",
  "top-mid": "",
  "top-left": "",
  "top-right": "",
  bottom: "",
  "bottom-mid": "",
  "bottom-left": "",
  "bottom-right": "",
  left: "",
  "left-mid": "",
  mid: "",
  "mid-mid": "",
  right: "",
  "right-mid": "",
  middle: "  ",
};

// Inline-markup post-processor for plain strings authored in env-vars.ts:
//   `code-spans`   → cyan
//   **bold-spans** → bold
function applyInlineMarkup(text: string): string {
  return text
    .replaceAll(/\*\*([^*]+)\*\*/g, (_m, inner: string) => c.bold(inner))
    .replaceAll(/`([^`]+)`/g, (_m, inner: string) => c.code(inner));
}

function stripInlineMarkup(text: string): string {
  return text
    .replaceAll(/\*\*([^*]+)\*\*/g, "$1")
    .replaceAll(/`([^`]+)`/g, "$1");
}

function renderParagraph(text: string): string {
  return applyInlineMarkup(text);
}

function renderBlock(b: Block): string {
  switch (b.kind) {
    case "paragraph": {
      return renderParagraph(b.text);
    }
    case "bullets": {
      return b.items
        .map((item) => c.bullet(applyInlineMarkup(item)))
        .join("\n");
    }
    case "numbered": {
      return b.items
        .map((item, i) => c.numbered(i + 1, applyInlineMarkup(item)))
        .join("\n");
    }
    case "code": {
      const body = b.lines.map((line) => `  ${line}`).join("\n");
      return body.replaceAll(
        /^(\s*)\$ /gm,
        (_m, indent: string) => `${indent}${chalk.green("$ ")}`,
      );
    }
    case "note": {
      return c.callout.note(applyInlineMarkup(b.text));
    }
    case "important": {
      return c.callout.important(applyInlineMarkup(b.text));
    }
    case "table": {
      const t = new Table({
        head: b.headers.map((h) => c.bold(h)),
        chars: BORDERLESS_TABLE_CHARS,
        style: { "padding-left": 0, "padding-right": 2, head: [], border: [] },
      });
      for (const row of b.rows)
        t.push(row.map((cell) => applyInlineMarkup(cell)));
      return t.toString();
    }
  }
}

function renderPropertyTable(rows: Array<[string, string]>): string {
  if (rows.length === 0) return "";
  const t = new Table({
    chars: BORDERLESS_TABLE_CHARS,
    style: { "padding-left": 0, "padding-right": 2, head: [], border: [] },
  });
  for (const [k, v] of rows) t.push([c.bold(k), applyInlineMarkup(v)]);
  return t.toString();
}

function buildPropertyTable(v: EnvVarEntry): Array<[string, string]> {
  const rows: Array<[string, string]> = [["Format", v.format]];
  if (v.appliesTo.length > 0) {
    rows.push([
      "Applicable commands",
      v.appliesTo.map((s) => `\`${s}\``).join(", "),
    ]);
  }
  if (v.default_ && v.default_ !== "None" && v.default_ !== "Not set") {
    rows.push(["Default", v.default_]);
  }
  if (v.precedence) {
    rows.push(["Precedence", v.precedence]);
  }
  return rows;
}

function renderDetailSection(s: DetailSection): string {
  const parts: string[] = [];
  if (s.heading) parts.push(c.bold(`${s.heading}:`));
  for (const block of s.blocks) parts.push(renderBlock(block));
  return parts.join("\n\n");
}

function renderVarSection(v: EnvVarEntry): string {
  const parts: string[] = [c.varHeading(v.name), applyInlineMarkup(v.intro)];
  const tbl = renderPropertyTable(buildPropertyTable(v));
  if (tbl) parts.push(tbl);
  for (const section of v.details) parts.push(renderDetailSection(section));
  parts.push(
    c.bold("Example:"),
    v.example.lines.map((line) => `  ${chalk.green("$ ")}${line}`).join("\n"),
  );
  return parts.join("\n\n");
}

export function getEnvVarSummaries(): Array<{ name: string; summary: string }> {
  return ENV_VARS_DATA.variables.map((v) => ({
    name: v.name,
    summary: stripInlineMarkup(v.summary),
  }));
}

export function renderMinimalReference(): string {
  const entries = getEnvVarSummaries();
  const maxNameLength = Math.max(...entries.map((e) => e.name.length));
  const prefix = "ably env ";
  const padTarget = prefix.length + maxNameLength + 2;

  const lines: string[] = [
    "Ably Environment variables for authentication and configuration of default settings",
    "",
  ];
  for (const e of entries) {
    const left = `${prefix}${e.name}`;
    const padded = left.padEnd(padTarget);
    const colored = c.code(padded);
    lines.push(`  ${colored} - ${e.summary}`);
  }
  lines.push("", `Run \`${c.code("ably env --help")}\` for more information.`);
  return lines.join("\n") + "\n";
}

export function renderSingleVar(name: string): string {
  const section = ENV_VARS_DATA.variables.find((v) => v.name === name);
  if (!section) {
    throw new Error(`No section defined for env var: ${name}`);
  }
  return renderVarSection(section) + "\n";
}
