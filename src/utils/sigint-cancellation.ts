// Ctrl+C handling for commands that mix spinners and interactive prompts.
//
// Two behaviours combine to make Ctrl+C unreliable without this:
//
//   - Prompts such as legacy inquirer handle Ctrl+C by closing their readline
//     and re-raising SIGINT with `process.kill`. Once any JS SIGINT listener
//     exists (ora installs one via signal-exit), that signal is only delivered
//     on a later event-loop turn. Signal handles don't keep the loop alive, so
//     with the prompt closed Node can run out of work first and exit with
//     "Detected unsettled top-level await" (exit code 13).
//   - A listener cannot exit an oclif command by throwing: `this.exit()` throws
//     an ExitError, and from inside an event listener that surfaces as an
//     uncaught exception rather than a clean exit.
//
// `withSigintCancellation` owns SIGINT for the duration of a task, keeps the
// event loop alive so a re-raised signal is always delivered, and turns Ctrl+C
// into a rejection the command can handle on its normal async path.

import type * as readline from "node:readline";

/**
 * Raised when the user presses Ctrl+C, either while `withSigintCancellation`
 * owns SIGINT or at a `promptForConfirmation` prompt.
 */
export class InterruptError extends Error {
  constructor() {
    super("Interrupted by user");
    this.name = "InterruptError";
  }
}

/**
 * Run `task`, rejecting with an `InterruptError` when the user presses Ctrl+C.
 *
 * The task receives an `AbortSignal` that is aborted on Ctrl+C, so in-flight
 * work (fetches, polling loops, spinners) can stop and clean up. Abort
 * listeners run synchronously, before the rejection reaches the caller.
 *
 * The task's own promise is raced rather than awaited, because some prompts
 * (legacy inquirer) never settle once force-closed.
 */
export async function withSigintCancellation<T>(
  task: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const interrupted = new Promise<never>((_, reject) => {
    controller.signal.addEventListener(
      "abort",
      () => reject(new InterruptError()),
      { once: true },
    );
  });
  const onSigint = () => controller.abort();

  process.on("SIGINT", onSigint);
  // Keep the event loop alive until the task settles, so a SIGINT re-raised
  // by a prompt that has already closed its input is still delivered. Prompts
  // only see Ctrl+C as a keypress on a TTY; elsewhere this would turn a prompt
  // stuck on closed stdin into a hang.
  const keepAlive = process.stdin.isTTY
    ? setInterval(() => {}, 1 << 30)
    : undefined;
  try {
    return await Promise.race([task(controller.signal), interrupted]);
  } finally {
    clearInterval(keepAlive);
    process.removeListener("SIGINT", onSigint);
  }
}

/**
 * Re-raise Ctrl+C at a readline prompt as a process SIGINT.
 *
 * Without a SIGINT listener, readline swallows Ctrl+C and only pauses its
 * input, leaving the prompt's promise pending forever. Closing the prompt and
 * re-raising lets whoever owns SIGINT (`withSigintCancellation`, or Node's
 * default handler) end the command.
 */
export function forwardSigintToProcess(rl: readline.Interface): void {
  rl.on("SIGINT", () => {
    rl.close();
    process.kill(process.pid, "SIGINT");
  });
}
