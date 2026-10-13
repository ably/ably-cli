// Utility functions for commands that need to stay alive until
// the user presses Ctrl+C *or* a timeout elapses.  A timeout can be
// supplied explicitly via the `--duration` flag or implicitly via the
// `ABLY_CLI_DEFAULT_DURATION` environment variable.
//
// The logic is intentionally tiny so that commands can just
// `await waitUntilInterruptedOrTimeout(durationSeconds)`.

import isTestMode from "./test-mode.js";

export type ExitReason = "signal" | "timeout" | "aborted";

/**
 * Wait until Ctrl+C, the duration elapses, or `signal` aborts (which a
 * command uses to stop waiting on a connection that has died).
 */
export async function waitUntilInterruptedOrTimeout(
  durationSeconds?: number,
  signal?: AbortSignal,
): Promise<ExitReason> {
  // In test mode, we may have many instances running concurrently
  // Increase the max listeners to avoid warnings
  if (isTestMode()) {
    const currentMax = process.getMaxListeners();
    if (currentMax < 50) {
      process.setMaxListeners(50);
    }
  }

  return new Promise<ExitReason>((resolve) => {
    let sigintHandler: (() => void) | undefined;
    let sigtermHandler: (() => void) | undefined;
    let resolved = false;
    const abortHandler = (): void => handleExit("aborted");

    const handleExit = (reason: ExitReason): void => {
      if (resolved) {
        return;
      }
      resolved = true;

      if (timeoutId) clearTimeout(timeoutId);

      // Remove signal handlers if they were installed
      if (sigintHandler) process.removeListener("SIGINT", sigintHandler);
      if (sigtermHandler) process.removeListener("SIGTERM", sigtermHandler);
      signal?.removeEventListener("abort", abortHandler);

      resolve(reason);
    };

    // Optional duration based timeout. 0 / undefined => run forever.
    // Check explicit duration first, then environment variable
    let timeoutId: NodeJS.Timeout | undefined;
    const effectiveDuration =
      typeof durationSeconds === "number" && durationSeconds > 0
        ? durationSeconds
        : process.env.ABLY_CLI_DEFAULT_DURATION
          ? Number(process.env.ABLY_CLI_DEFAULT_DURATION) > 0
            ? Number(process.env.ABLY_CLI_DEFAULT_DURATION)
            : undefined
          : undefined;

    if (effectiveDuration) {
      timeoutId = setTimeout(() => {
        handleExit("timeout");
      }, effectiveDuration * 1000);
    }

    // Install signal handlers
    sigintHandler = (): void => handleExit("signal");
    sigtermHandler = (): void => handleExit("signal");

    process.once("SIGINT", sigintHandler);
    process.once("SIGTERM", sigtermHandler);

    if (signal?.aborted) {
      handleExit("aborted");
    } else {
      signal?.addEventListener("abort", abortHandler);
    }
  });
}
