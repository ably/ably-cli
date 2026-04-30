import chalk from "chalk";
import Table from "cli-table3";

import {
  type Block,
  type CrossCuttingSection,
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

// Inline-markup post-processor: applies the small editing convention used in
// data.ts so authors can write plain strings.
//   - `code-spans`     → cyan
//   - **bold-spans**   → bold
//   - URLs             → dim wrapped in parentheses when standalone
function applyInlineMarkup(text: string): string {
  return text
    .replaceAll(/\*\*([^*]+)\*\*/g, (_m, inner: string) => c.bold(inner))
    .replaceAll(/`([^`]+)`/g, (_m, inner: string) => c.code(inner));
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
  return parts.join("\n\n");
}

function renderCrossCutting(s: CrossCuttingSection): string {
  const head = c.category(s.heading);
  return [head, ...s.blocks.map((b) => renderBlock(b))].join("\n\n");
}

function renderPrerequisites(): string {
  const lines = ENV_VARS_DATA.meta.prerequisites.map((p) => {
    const cmds = p.commands.map((cmd) => c.code(cmd)).join(", ");
    const vars = p.authVars
      .map((v) => c.code(v))
      .join(p.authVars.length > 1 ? " or " : "");
    return c.bullet(`${c.bold(p.label)} (${cmds}) authenticate via ${vars}.`);
  });
  return lines.join("\n");
}

function renderHeader(): string {
  return [
    applyInlineMarkup(ENV_VARS_DATA.meta.lede),
    c.callout.note(applyInlineMarkup(ENV_VARS_DATA.meta.note)),
  ].join("\n\n");
}

function renderExampleBlock(v: EnvVarEntry): string {
  const heading = `${c.varHeading(v.name)} — ${applyInlineMarkup(v.example.description)}`;
  const codeLines = v.example.lines.map(
    (line) => `    ${chalk.green("$ ")}${line}`,
  );
  return [heading, ...codeLines].join("\n");
}

export function renderMinimalReference(): string {
  const parts: string[] = [
    renderHeader(),
    c.category("Prerequisites"),
    renderPrerequisites(),
    c.category("Examples"),
    ENV_VARS_DATA.variables.map((v) => renderExampleBlock(v)).join("\n\n"),
    c.dim("TIP: Run `ably env <NAME>` for a focused single-variable view."),
  ];
  return parts.join("\n\n") + "\n";
}

export function renderSingleVar(name: string): string {
  const section = ENV_VARS_DATA.variables.find((v) => v.name === name);
  if (!section) {
    throw new Error(`No section defined for env var: ${name}`);
  }
  return renderVarSection(section) + "\n";
}

export function listVarNames(): string[] {
  return ENV_VARS_DATA.variables.map((v) => v.name);
}

// Re-exports used by env command (cross-cutting JSON payload).
export { renderCrossCutting };
