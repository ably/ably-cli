import { describe, it, expect, beforeAll } from "vitest";
import { spawn, exec, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Helper to spawn an interactive CLI process and wait for it to be ready
 * before sending commands. Fixes flakiness from hardcoded setTimeout delays.
 */
function spawnInteractive(
  binPath: string,
): ChildProcess & { ready: Promise<void> } {
  const child = spawn("node", [binPath, "interactive"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      ABLY_INTERACTIVE_MODE: "true",
      ABLY_SUPPRESS_WELCOME: "1",
    },
  });

  // Wait for the interactive prompt to appear before sending input
  const ready = new Promise<void>((resolve) => {
    let buf = "";
    const onData = (data: Buffer) => {
      buf += data.toString();
      if (buf.includes("ably>")) {
        child.stdout.removeListener("data", onData);
        resolve();
      }
    };
    child.stdout.on("data", onData);
    // Fallback in case prompt text differs
    setTimeout(resolve, 3000);
  });

  return Object.assign(child, { ready });
}

/**
 * Collect all stdout/stderr from a child process and return on exit.
 * Assertions run inside the returned promise so failures reject properly.
 */
function collectOutput(child: ChildProcess): {
  stdout: () => string;
  stderr: () => string;
  onExit: (
    assertions: (stdout: string, stderr: string) => void,
  ) => Promise<void>;
} {
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (d) => (stdout += d.toString()));
  child.stderr?.on("data", (d) => (stderr += d.toString()));

  return {
    stdout: () => stdout,
    stderr: () => stderr,
    onExit: (assertions) =>
      new Promise<void>((resolve, reject) => {
        const killTimeout = setTimeout(() => {
          child.kill("SIGTERM");
          reject(
            new Error(
              "Test timed out - process did not exit. Output: " +
                stdout +
                stderr,
            ),
          );
        }, 10000);

        child.on("exit", () => {
          clearTimeout(killTimeout);
          try {
            assertions(stdout, stderr);
            resolve();
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
      }),
  };
}

describe("Did You Mean Functionality", () => {
  const timeout = 15000;
  let binPath: string;

  beforeAll(() => {
    binPath = path.join(__dirname, "../../../bin/development.js");
  });

  describe("Top-Level Command Suggestions", () => {
    describe("Interactive Mode", () => {
      it(
        "should show Y/N prompt for misspelled commands",
        async () => {
          const child = spawnInteractive(binPath);
          const io = collectOutput(child);
          let foundPrompt = false;

          child.stdout!.on("data", (data) => {
            if (
              data.toString().includes("[Y/n]") ||
              data.toString().includes("Did you mean accounts current?")
            ) {
              foundPrompt = true;
              setTimeout(() => child.stdin!.write("n\n"), 100);
            }
          });

          await child.ready;
          child.stdin!.write("account current\n");

          setTimeout(() => child.stdin!.write("exit\n"), 3000);

          await io.onExit((stdout) => {
            expect(foundPrompt).toBe(true);
            expect(stdout).toContain("account current is not an ably command");
          });
        },
        timeout,
      );
    });

    describe("Non-Interactive Mode", () => {
      it(
        "should show Y/N prompt for misspelled commands",
        async () => {
          const result = await execAsync(`node ${binPath} account current`, {
            timeout: 2000,
          }).catch((error) => error);

          const fullOutput = (result.stdout || "") + (result.stderr || "");
          expect(fullOutput).toContain("Did you mean accounts current?");
          expect(fullOutput).toContain("[Y/n]");
        },
        timeout,
      );

      it(
        "should auto-execute with SKIP_CONFIRMATION=1",
        async () => {
          const result = await execAsync(
            `SKIP_CONFIRMATION=1 ABLY_ACCESS_TOKEN=test node ${binPath} account current`,
            {
              timeout: 5000,
              env: {
                ...process.env,
                SKIP_CONFIRMATION: "1",
                ABLY_ACCESS_TOKEN: "test",
              },
            },
          ).catch((error) => error);

          const fullOutput = (result.stdout || "") + (result.stderr || "");
          expect(fullOutput).toContain(
            "account current is not an ably command",
          );
        },
        timeout,
      );
    });
  });

  describe("Second-Level Command Suggestions", () => {
    describe("Interactive Mode", () => {
      it(
        'should show Y/N prompt for "accounts curren"',
        async () => {
          const child = spawnInteractive(binPath);
          const io = collectOutput(child);
          let foundPrompt = false;

          child.stdout!.on("data", (data) => {
            if (
              data.toString().includes("Did you mean accounts current?") ||
              data.toString().includes("[Y/n]")
            ) {
              foundPrompt = true;
              setTimeout(() => child.stdin!.write("n\n"), 100);
            }

            // If we see this, then the `n` was received
            if (data.toString().includes("Ably accounts management commands")) {
              setTimeout(() => child.stdin!.write("exit\n"), 1000);
            }
          });

          await child.ready;
          child.stdin!.write("accounts curren\n");

          await io.onExit((stdout, stderr) => {
            const fullOutput = stdout + stderr;
            expect(foundPrompt).toBe(true);
            expect(fullOutput).toContain(
              "accounts curren is not an ably command",
            );
          });
        },
        timeout,
      );

      it(
        "should execute command when confirmed with Y",
        async () => {
          const child = spawnInteractive(binPath);
          const io = collectOutput(child);
          let foundPrompt = false;
          let executedCommand = false;

          child.stdout!.on("data", (data) => {
            if (
              data.toString().includes("Did you mean accounts current?") ||
              data.toString().includes("[Y/n]")
            ) {
              foundPrompt = true;
              setTimeout(() => child.stdin!.write("y\n"), 100);
            }

            // Check for various outputs that indicate the command was executed
            const chunk = data.toString();
            if (
              chunk.includes("Account:") ||
              chunk.includes("Show the current Ably account") ||
              chunk.includes("No access token provided") ||
              chunk.includes("accounts current") ||
              chunk.includes("No account currently selected") ||
              chunk.includes("You are not logged in") ||
              chunk.includes("Authentication required") ||
              chunk.includes("Error:")
            ) {
              executedCommand = true;
              setTimeout(() => child.stdin!.write("exit\n"), 1000);
            }
          });

          child.stderr!.on("data", (data) => {
            const errorOutput = data.toString();
            if (
              errorOutput.includes("No access token provided") ||
              errorOutput.includes("No account currently selected") ||
              errorOutput.includes("You are not logged in") ||
              errorOutput.includes("Authentication required") ||
              errorOutput.includes("Error:")
            ) {
              executedCommand = true;
              setTimeout(() => child.stdin!.write("exit\n"), 1000);
            }
          });

          await child.ready;
          child.stdin!.write("accounts curren\n");

          await io.onExit(() => {
            expect(foundPrompt).toBe(true);
            expect(executedCommand).toBe(true);
          });
        },
        timeout,
      );
    });

    describe("Non-Interactive Mode", () => {
      it(
        'should show Y/N prompt for "accounts curren"',
        async () => {
          const result = await execAsync(`node ${binPath} accounts curren`, {
            timeout: 2000,
          }).catch((error) => error);

          const fullOutput = (result.stdout || "") + (result.stderr || "");
          expect(fullOutput).toContain("Did you mean accounts current?");
          expect(fullOutput).toContain("[Y/n]");
        },
        timeout,
      );
    });
  });

  describe("Command List Display", () => {
    it(
      "should show available commands after declining suggestion",
      async () => {
        const child = spawnInteractive(binPath);
        const io = collectOutput(child);
        let foundPrompt = false;
        let foundCommandsList = false;

        child.stdout!.on("data", (data) => {
          if (data.toString().includes("Did you mean accounts current?")) {
            foundPrompt = true;
            setTimeout(() => child.stdin!.write("n\n"), 100);
          }

          if (
            data.toString().includes("accounts current") &&
            data.toString().includes("Show the current Ably account")
          ) {
            foundCommandsList = true;
          }
        });

        await child.ready;
        child.stdin!.write("accounts curren\n");

        setTimeout(() => child.stdin!.write("exit\n"), 4000);

        await io.onExit((stdout) => {
          expect(foundPrompt).toBe(true);
          expect(foundCommandsList).toBe(true);
          expect(stdout).toContain("Ably accounts management commands:");
        });
      },
      timeout,
    );

    it(
      "should show commands when no suggestion found",
      async () => {
        const child = spawnInteractive(binPath);
        const io = collectOutput(child);
        let foundCommandsList = false;

        child.stdout!.on("data", (data) => {
          if (
            data.toString().includes("accounts current") &&
            data.toString().includes("Show the current Ably account")
          ) {
            foundCommandsList = true;
            setTimeout(() => child.stdin!.write("exit\n"), 1500);
          }
        });

        await child.ready;
        child.stdin!.write("accounts xyz\n");

        await io.onExit((stdout, stderr) => {
          const fullOutput = stdout + stderr;
          expect(foundCommandsList).toBe(true);
          expect(fullOutput).toContain("Command accounts xyz not found");
          expect(fullOutput).toContain("Ably accounts management commands:");
          expect(fullOutput).not.toContain("[Y/n]");
        });
      },
      timeout,
    );
  });

  describe("Consistent Behavior", () => {
    it(
      "should behave consistently between top-level and second-level commands",
      async () => {
        // Both should timeout waiting for Y/N prompt
        const result1 = await execAsync(`node ${binPath} account current`, {
          timeout: 2000,
        }).catch((error) => error);
        expect(result1.stdout + result1.stderr).toContain("[Y/n]");

        const result2 = await execAsync(`node ${binPath} accounts curren`, {
          timeout: 2000,
        }).catch((error) => error);
        expect(result2.stdout + result2.stderr).toContain("[Y/n]");
      },
      timeout,
    );
  });
});
