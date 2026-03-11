/**
 * TTY test helper — uses node-pty to create real pseudo-terminals.
 *
 * These tests require a real TTY and should only be run locally:
 *   pnpm test:tty
 *
 * They are excluded from CI (GitHub Actions runners have no TTY).
 */
import * as nodePty from "node-pty";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BIN_PATH = path.join(__dirname, "../../bin/development.js");

export const DEFAULT_ENV = {
  ...process.env,
  ABLY_INTERACTIVE_MODE: "true",
  ABLY_SUPPRESS_WELCOME: "1",
  ABLY_WRAPPER_MODE: "1",
  NO_COLOR: "1",
};

export interface TtyProcess {
  pty: nodePty.IPty;
  output: string;
  exitCode: number | null;
  exited: boolean;
  /** Promise that resolves when the process exits */
  exitPromise: Promise<{ code: number }>;
}

/**
 * Spawn an interactive CLI process inside a real pseudo-terminal.
 */
export function spawnTty(
  args: string[] = ["interactive"],
  env: Record<string, string | undefined> = {},
): TtyProcess {
  const childEnv = {
    ...DEFAULT_ENV,
    ...env,
  };

  const pty = nodePty.spawn("node", [BIN_PATH, ...args], {
    name: "xterm-256color",
    cols: 120,
    rows: 30,
    env: childEnv as Record<string, string>,
  });

  const proc: TtyProcess = {
    pty,
    output: "",
    exitCode: null,
    exited: false,
    exitPromise: null!,
  };

  proc.exitPromise = new Promise<{ code: number }>((resolve) => {
    pty.onExit(({ exitCode }) => {
      proc.exitCode = exitCode;
      proc.exited = true;
      resolve({ code: exitCode });
    });
  });

  pty.onData((data: string) => {
    proc.output += data;
  });

  return proc;
}

/**
 * Wait until the accumulated output contains a pattern, or timeout.
 */
export async function waitForOutput(
  proc: TtyProcess,
  pattern: string | RegExp,
  timeoutMs = 8000,
): Promise<void> {
  const start = Date.now();
  const matches = (text: string) =>
    typeof pattern === "string" ? text.includes(pattern) : pattern.test(text);

  while (Date.now() - start < timeoutMs) {
    if (matches(proc.output)) return;
    if (proc.exited) {
      throw new Error(
        `Process exited (code ${proc.exitCode}) before "${pattern}" appeared.\nOutput: ${proc.output}`,
      );
    }
    await sleep(50);
  }

  throw new Error(
    `Timed out waiting for "${pattern}" after ${timeoutMs}ms.\nOutput: ${proc.output}`,
  );
}

/**
 * Write text to the PTY (simulates keyboard input).
 */
export function writeTty(proc: TtyProcess, text: string): void {
  proc.pty.write(text);
}

/**
 * Send Ctrl+C (0x03) to the PTY.
 */
export function sendCtrlC(proc: TtyProcess): void {
  proc.pty.write("\u0003");
}

/**
 * Kill the PTY process. Safe to call multiple times.
 */
export function killTty(proc: TtyProcess): void {
  if (!proc.exited) {
    proc.pty.kill();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
