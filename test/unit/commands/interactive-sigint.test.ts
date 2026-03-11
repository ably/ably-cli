import { describe, it, expect, beforeAll } from "vitest";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Interactive Mode - SIGINT Handling", () => {
  const timeout = 10000;
  let binPath: string;

  beforeAll(() => {
    binPath = path.join(__dirname, "../../../bin/development.js");
  });

  it(
    "should handle Ctrl+C during command execution by returning to prompt",
    (done) => {
      const child = spawn("node", [binPath, "interactive"], {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          ABLY_INTERACTIVE_MODE: "true",
          ABLY_SUPPRESS_WELCOME: "1",
          ABLY_WRAPPER_MODE: "1",
        },
      });

      let capturedOutput = "";
      let errorOutput = "";
      let commandStarted = false;
      let promptSeen = false;
      let promptCount = 0;

      child.stdout.on("data", (data) => {
        const output = data.toString();
        capturedOutput += output;

        // Count prompts
        const promptMatches = output.match(/ably> /g);
        if (promptMatches) {
          promptCount += promptMatches.length;
        }

        // Check for initial prompt (with or without ANSI codes)
        if (
          !promptSeen &&
          (output.includes("ably> ") || output.includes("$\u001B"))
        ) {
          promptSeen = true;
          // Send test:wait command after seeing prompt
          setTimeout(() => {
            child.stdin.write("test:wait --duration 10\n");
          }, 100);
        }

        // Check if test:wait command started
        if (output.includes("Waiting for")) {
          commandStarted = true;
          // Send SIGINT after a short delay
          setTimeout(() => {
            child.kill("SIGINT");
          }, 500);
        }

        // After SIGINT, we should get back to prompt
        if (commandStarted && promptCount >= 2) {
          // We're back at prompt after interrupt - send exit
          setTimeout(() => {
            child.stdin.write("exit\n");
          }, 100);
        }
      });

      child.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      child.on("exit", (code) => {
        // Should exit with code 0 or 42 (user exit)
        expect([0, 42]).toContain(code);
        // Should have sent the command
        expect(commandStarted).toBe(true);
        // Should have returned to prompt (at least 2 prompts)
        expect(promptCount).toBeGreaterThanOrEqual(2);
        // Should show interrupt feedback
        expect(capturedOutput + errorOutput).toContain("↓ Stopping");
        // Should not have EIO errors
        expect(errorOutput).not.toContain("Error: read EIO");
        expect(errorOutput).not.toContain("setRawMode EIO");
        done();
      });

      // Timeout fallback - always send exit to prevent hanging
      setTimeout(() => {
        child.stdin.write("exit\n");
      }, timeout - 1000);
    },
    timeout,
  );

  // TTY-dependent Ctrl+C tests (empty prompt, partial input) moved to:
  // test/tty/commands/interactive-sigint.test.ts
  // Run with: pnpm test:tty
  // See: https://github.com/ably/cli/issues/70

  it(
    "should exit with code 130 on double Ctrl+C (force quit)",
    (done) => {
      const child = spawn("node", [binPath, "interactive"], {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          ABLY_INTERACTIVE_MODE: "true",
          ABLY_SUPPRESS_WELCOME: "1",
          ABLY_WRAPPER_MODE: "1",
        },
      });

      let errorOutput = "";
      let promptSeen = false;

      child.stdout.on("data", (data) => {
        const output = data.toString();

        if (
          !promptSeen &&
          (output.includes("ably> ") || output.includes("$\u001B"))
        ) {
          promptSeen = true;
          // Send test:wait command
          setTimeout(() => {
            child.stdin.write("test:wait --duration 10\n");
          }, 100);
        }

        // When command starts, send double SIGINT
        if (output.includes("Waiting for")) {
          setTimeout(() => {
            child.kill("SIGINT");
            // Send second SIGINT quickly
            setTimeout(() => {
              child.kill("SIGINT");
            }, 200);
          }, 100);
        }
      });

      child.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      child.on("exit", (code) => {
        // Should exit with code 130 (double SIGINT force quit)
        expect(code).toBe(130);
        // Should show force quit message
        expect(errorOutput).toContain("⚠ Force quit");
        done();
      });
    },
    timeout,
  );
});
