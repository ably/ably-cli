/**
 * TTY-dependent SIGINT tests for interactive mode.
 *
 * These tests use node-pty to create real pseudo-terminals, which makes
 * readline's SIGINT handling work correctly (unlike piped stdio).
 *
 * Run locally with: pnpm test:tty
 * NOT run in CI — GitHub Actions runners have no TTY.
 *
 * Migrated from:
 *   - test/unit/commands/interactive-sigint.test.ts (2 skipped tests)
 *   - test/unit/commands/interactive.test.ts (2 skipped tests in describe.skip)
 * See: https://github.com/ably/cli/issues/70
 */
import { describe, it, expect, afterEach } from "vitest";

import {
  spawnTty,
  waitForOutput,
  writeTty,
  sendCtrlC,
  killTty,
  type TtyProcess,
} from "../tty-test-helper.js";

describe("Interactive Mode - SIGINT Handling (TTY)", () => {
  const timeout = 15000;
  let proc: TtyProcess | null = null;

  afterEach(() => {
    if (proc) {
      killTty(proc);
      proc = null;
    }
  });

  it(
    "should handle Ctrl+C on empty prompt",
    async () => {
      proc = spawnTty();

      // Wait for the initial prompt
      await waitForOutput(proc, "ably>");

      // Send Ctrl+C on the empty prompt
      sendCtrlC(proc);

      // Should show ^C and return to a new prompt
      await waitForOutput(proc, "^C");

      // Send exit to cleanly terminate
      writeTty(proc, "exit\n");

      const { code } = await proc.exitPromise;
      expect([0, 42]).toContain(code);
    },
    timeout,
  );

  it(
    "should handle Ctrl+C with partial command input",
    async () => {
      proc = spawnTty();

      await waitForOutput(proc, "ably>");

      // Type a partial command (don't press Enter)
      writeTty(proc, "channels sub");

      // Give the PTY a moment to echo the typed text
      await waitForOutput(proc, "channels sub");

      // Send Ctrl+C to cancel the partial input
      sendCtrlC(proc);

      // Should show ^C — line is cancelled
      await waitForOutput(proc, "^C");

      // Send exit to terminate
      writeTty(proc, "exit\n");

      const { code } = await proc.exitPromise;
      expect([0, 42]).toContain(code);
    },
    timeout,
  );

  it(
    "should interrupt a running command with Ctrl+C and return to prompt",
    async () => {
      proc = spawnTty();

      await waitForOutput(proc, "ably>");

      // Start a long-running command
      writeTty(proc, "test:wait --duration 30\n");

      // Wait for the command to start
      await waitForOutput(proc, "Waiting for");

      // Send Ctrl+C to interrupt the running command
      sendCtrlC(proc);

      // Should show stopping feedback and return to prompt
      await waitForOutput(proc, "Stopping");

      // Send exit to cleanly terminate
      writeTty(proc, "exit\n");

      const { code } = await proc.exitPromise;
      // 0 (clean exit) or 42 (user exit via `exit` command)
      expect([0, 42]).toContain(code);

      // Should NOT have EIO errors
      expect(proc.output).not.toContain("Error: read EIO");
      expect(proc.output).not.toContain("setRawMode EIO");
    },
    timeout,
  );

  it(
    "should handle Ctrl+C on empty prompt (direct spawn)",
    async () => {
      proc = spawnTty(["interactive"], {
        ...process.env,
        ABLY_SUPPRESS_WELCOME: "1",
        NO_COLOR: "1",
      });

      // Wait for the prompt character
      await waitForOutput(proc, /[$>]/);

      // Send Ctrl+C character
      sendCtrlC(proc);

      // Should show ^C
      await waitForOutput(proc, "^C");

      // Send exit
      writeTty(proc, "exit\n");

      const { code } = await proc.exitPromise;
      expect([0, 42]).toContain(code);
    },
    timeout,
  );
});
