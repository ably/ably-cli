/**
 * Ctrl+C at a y/n confirmation prompt inside `ably interactive` must cancel
 * the command and return to the shell prompt, not exit the shell.
 *
 * Run locally with: pnpm test:tty
 * NOT run in CI — GitHub Actions runners have no TTY.
 */
import { describe, it, expect, afterEach } from "vitest";

import {
  spawnTty,
  waitForOutput,
  writeTty,
  sendCtrlC,
  killTty,
  PROMPT_PATTERN,
  type TtyProcess,
} from "../tty-test-helper.js";

describe("Interactive Mode - Ctrl+C at a confirmation prompt (TTY)", () => {
  const timeout = 20000;
  let proc: TtyProcess | null = null;

  afterEach(async () => {
    if (proc) {
      await killTty(proc);
      proc = null;
    }
  });

  it(
    "cancels the command and keeps the shell running",
    async () => {
      proc = spawnTty(["interactive"], {
        // Run the real exit path rather than test-mode stubs.
        ABLY_CLI_TEST_MODE: undefined,
        // `push devices remove` prompts before making any network call.
        ABLY_API_KEY: "app.key:secret",
      });

      await waitForOutput(proc, PROMPT_PATTERN);

      writeTty(proc, "push devices remove dev1\r");
      await waitForOutput(proc, "[y/n]");

      sendCtrlC(proc);

      // The command unwinds with an interrupt error and the shell shows a
      // fresh prompt instead of exiting.
      await waitForOutput(proc, /Interrupted by user[\s\S]*ably>/);
      expect(proc.exited).toBe(false);

      // The shell still accepts and runs commands.
      writeTty(proc, "version\r");
      await waitForOutput(proc, "Version: ");
      expect(proc.exited).toBe(false);

      writeTty(proc, "exit\r");
      const { code } = await proc.exitPromise;
      // 42 = user exit via `exit` in wrapper mode
      expect(code).toBe(42);
    },
    timeout,
  );
});
