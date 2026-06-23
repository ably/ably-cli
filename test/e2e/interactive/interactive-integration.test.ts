import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Integration tests for `ably interactive` running as a single process (no bash
 * wrapper — the `ably-interactive` wrapper binary has been removed).
 *
 * These run over piped stdio (non-TTY). Ctrl+C delivered as a real SIGINT signal
 * is handled in-process: the running command unwinds and the shell returns to the
 * prompt in the SAME process — there is no restart. Real-terminal (TTY) SIGINT
 * behaviour and terminal-state/EIO assertions live in
 * test/tty/commands/interactive-sigint.test.ts (run with `pnpm test:tty`).
 */
describe("Interactive Mode - in-process integration", () => {
  const binPath = path.join(__dirname, "../../../bin/run.js");

  it("starts and exits cleanly via `exit`", { timeout: 30000 }, async () => {
    const proc = spawn("node", [binPath, "interactive"], {
      stdio: "pipe",
      env: { ...process.env, ABLY_SUPPRESS_WELCOME: "1" },
    });

    let output = "";
    proc.stdout.on("data", (d) => (output += d.toString()));

    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (output.includes("ably>")) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });

    proc.stdin.write("exit\n");

    const exitCode = await new Promise<number>((resolve) => {
      proc.on("exit", (code) => resolve(code ?? 0));
    });

    expect(exitCode).toBe(0);
    expect(output).toContain("Goodbye!");
  });

  it(
    "interrupts a running command via SIGINT and stays alive in the same process",
    { timeout: 30000 },
    async () => {
      const proc = spawn("node", [binPath, "interactive"], {
        stdio: "pipe",
        env: { ...process.env, ABLY_SUPPRESS_WELCOME: "1" },
      });

      let output = "";
      let exited = false;
      proc.stdout.on("data", (d) => (output += d.toString()));
      proc.stderr.on("data", (d) => (output += d.toString()));
      proc.on("exit", () => (exited = true));

      const waitFor = (substr: string, timeoutMs: number) =>
        new Promise<void>((resolve, reject) => {
          const start = Date.now();
          const check = setInterval(() => {
            if (output.includes(substr)) {
              clearInterval(check);
              resolve();
            } else if (exited) {
              clearInterval(check);
              reject(new Error(`process exited before "${substr}"`));
            } else if (Date.now() - start > timeoutMs) {
              clearInterval(check);
              reject(new Error(`timeout waiting for "${substr}"`));
            }
          }, 100);
        });

      await waitFor("ably>", 8000);

      // Start a long-running command, then interrupt it with a real SIGINT.
      proc.stdin.write("test:wait --duration 30\n");
      await waitFor("Waiting for", 8000);
      proc.kill("SIGINT");

      // The process must NOT exit; it should re-prompt and still run commands.
      await new Promise((r) => setTimeout(r, 500));
      expect(exited).toBe(false);

      proc.stdin.write("version\n");
      await waitFor("Version:", 6000);

      proc.stdin.write("exit\n");
      await new Promise<void>((resolve) => proc.on("exit", () => resolve()));

      expect(output).not.toMatch(/setRawMode EIO|Terminal state corrupted/);
    },
  );

  it(
    "emits exit code 42 on `exit` under ABLY_WRAPPER_MODE (host restart-loop contract)",
    { timeout: 30000 },
    async () => {
      const proc = spawn("node", [binPath, "interactive"], {
        stdio: "pipe",
        env: {
          ...process.env,
          ABLY_SUPPRESS_WELCOME: "1",
          ABLY_WRAPPER_MODE: "1",
        },
      });

      let output = "";
      proc.stdout.on("data", (d) => (output += d.toString()));

      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (output.includes("ably>")) {
            clearInterval(check);
            resolve();
          }
        }, 100);
      });

      proc.stdin.write("exit\n");

      const exitCode = await new Promise<number>((resolve) => {
        proc.on("exit", (code) => resolve(code ?? 0));
      });

      // 42 tells a host restart loop the user deliberately quit (vs. a crash).
      expect(exitCode).toBe(42);
    },
  );
});
