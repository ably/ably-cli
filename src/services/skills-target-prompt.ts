import { checkbox } from "@inquirer/prompts";
import * as readline from "node:readline";

import { formatHeading } from "../utils/output.js";
import { runInquirerWithReadlineRestore } from "../utils/readline-helper.js";
import isTestMode from "../utils/test-mode.js";
import { detectTools } from "./tool-detector.js";
import { TARGET_CONFIGS } from "./skills-installer.js";

export interface TargetPromptOptions {
  /** Stdout writer for headings (e.g. command's `this.log`). */
  log: (msg: string) => void;
  /** Warning emitter (e.g. command's `this.logWarning(msg, flags)`). */
  warn: (msg: string) => void;
  /** SIGINT handler that exits cleanly (e.g. `this.exit(130)`). */
  onSigint: () => void;
}

/**
 * Auto-detect installed AI coding tools and prompt the user to choose which to
 * configure. Returns:
 *   - `string[]` — chosen target IDs (may be empty if user picked nothing)
 *   - `null`     — no tools detected, or the user cancelled the prompt
 *
 * Only call this when stdout/stdin are TTYs and JSON mode is off; the caller
 * is responsible for that gating so it can fall through to non-interactive
 * auto-install when appropriate.
 */
export async function promptForTargets(
  opts: TargetPromptOptions,
): Promise<string[] | null> {
  opts.log(`\n${formatHeading("Detecting AI coding tools")}\n`);

  const detected = await detectTools();
  const choices = detected
    .filter((t) => t.detected && t.id in TARGET_CONFIGS)
    .map((t) => ({
      name: t.name,
      value: t.id,
      checked: true,
    }));

  if (choices.length === 0) {
    opts.warn(
      "No AI coding tools detected. Use --target to specify editors manually.",
    );
    return null;
  }

  // Test hook: short-circuit the interactive prompt so unit tests don't have
  // to drive a real TTY. Tests set globalThis.__TEST_MOCKS__.checkboxResponse
  // to either an array (the picked targets) or "throw" (simulate cancel).
  if (
    isTestMode() &&
    globalThis.__TEST_MOCKS__?.checkboxResponse !== undefined
  ) {
    const response = (
      globalThis.__TEST_MOCKS__ as { checkboxResponse: string[] | "throw" }
    ).checkboxResponse;
    return response === "throw" ? null : response;
  }

  // Take ownership of SIGINT during the prompt: inquirer's signal-exit
  // handler rejects the prompt promise, but Node still tears down the
  // top-level await before our catch runs. By exiting (130) here we make
  // cancellation deterministic and avoid the "unsettled top-level await"
  // warning.
  process.once("SIGINT", opts.onSigint);

  // When running inside the `ably interactive` shell, we must restore the
  // shell's readline state after inquirer takes over raw mode — otherwise
  // arrow keys emit escape sequences and the prompt never redraws.
  const interactiveReadline =
    process.env.ABLY_INTERACTIVE_MODE === "true"
      ? ((globalThis as Record<string, unknown>)
          .__ablyInteractiveReadline as readline.Interface | null)
      : null;

  try {
    return await runInquirerWithReadlineRestore(
      () =>
        checkbox<string>({
          message: "Which editor(s) would you like to configure?",
          choices,
        }),
      interactiveReadline,
    );
  } catch {
    return null;
  } finally {
    process.removeListener("SIGINT", opts.onSigint);
  }
}

export interface ResolveTargetsOptions {
  flags: { target: string[] };
  jsonMode: boolean;
  log: (msg: string) => void;
  warn: (msg: string) => void;
  exit: () => void;
}

/**
 * Apply the auto-detect → interactive-prompt → resolved-targets flow shared by
 * `init` and `skills install`. Returns the targets to install, or `null` if
 * the user cancelled or selected nothing (callers should bail out).
 *
 * When `--target auto` is not set, or when stdio is non-TTY, returns
 * `flags.target` unchanged so the runner can do its own auto-detection.
 */
export async function resolveSkillsTargets(
  opts: ResolveTargetsOptions,
): Promise<string[] | null> {
  const isAutoDetect = opts.flags.target.includes("auto");
  const isInteractive =
    !opts.jsonMode && Boolean(process.stdout.isTTY && process.stdin.isTTY);

  if (!(isAutoDetect && isInteractive)) return opts.flags.target;

  const picked = await promptForTargets({
    log: opts.log,
    warn: opts.warn,
    onSigint: opts.exit,
  });
  if (picked === null) return null;
  if (picked.length === 0) {
    opts.warn("No editors selected — skipping skill installation.");
    return null;
  }
  return picked;
}
