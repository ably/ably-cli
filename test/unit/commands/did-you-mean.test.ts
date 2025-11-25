import { describe, it, expect, beforeAll } from "vitest";
import { spawn, exec } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        async () =>
          new Promise<void>((resolve) => {
            const child = spawn("node", [binPath, "interactive"], {
              stdio: ["pipe", "pipe", "pipe"],
              env: {
                ...process.env,
                ABLY_INTERACTIVE_MODE: "true",
                ABLY_SUPPRESS_WELCOME: "1",
              },
            });

            let output = "";
            let foundPrompt = false;

            child.stdout.on("data", (data) => {
              output += data.toString();
              if (
                data.toString().includes("(Y/n)") ||
                data.toString().includes("Did you mean accounts current?")
              ) {
                foundPrompt = true;
                setTimeout(() => {
                  child.stdin.write("n\n");
                }, 100);
              }
            });

            setTimeout(() => {
              child.stdin.write("account current\n");
            }, 500);

            setTimeout(() => {
              child.stdin.write("exit\n");
            }, 2000);

            child.on("exit", () => {
              expect(foundPrompt).toBe(true);
              expect(output).toContain(
                "account current is not an ably command",
              );
              resolve();
            });
          }),
        timeout,
      );
    });

    describe("Non-Interactive Mode", () => {
      it(
        "should show Y/N prompt for misspelled commands",
        async () => {
          try {
            await execAsync(`node ${binPath} account current`, {
              timeout: 2000,
            });
            expect.fail("Should have timed out");
          } catch (error: any) {
            const fullOutput = (error.stdout || "") + (error.stderr || "");
            console.log("FULL OUTPUT:", fullOutput);
            expect(fullOutput).toContain("Did you mean accounts current?");
            expect(fullOutput).toContain("(Y/n)");
          }
        },
        timeout,
      );

      it(
        "should auto-execute with SKIP_CONFIRMATION=1",
        async () => {
          try {
            const { stdout, stderr } = await execAsync(
              `SKIP_CONFIRMATION=1 ABLY_ACCESS_TOKEN=test node ${binPath} account current`,
              {
                timeout: 5000,
                env: {
                  ...process.env,
                  SKIP_CONFIRMATION: "1",
                  ABLY_ACCESS_TOKEN: "test",
                },
              },
            );

            const fullOutput = stdout + stderr;
            expect(fullOutput).toContain(
              "account current is not an ably command",
            );
          } catch (error: any) {
            const fullOutput = (error.stdout || "") + (error.stderr || "");
            expect(fullOutput).toContain(
              "account current is not an ably command",
            );
          }
        },
        timeout,
      );
    });
  });

  describe("Second-Level Command Suggestions", () => {
    describe("Interactive Mode", () => {
      it(
        'should show Y/N prompt for "accounts curren"',
        async () =>
          new Promise<void>((resolve) => {
            const child = spawn("node", [binPath, "interactive"], {
              stdio: ["pipe", "pipe", "pipe"],
              env: {
                ...process.env,
                ABLY_INTERACTIVE_MODE: "true",
                ABLY_SUPPRESS_WELCOME: "1",
              },
            });

            let output = "";
            let errorOutput = "";
            let foundPrompt = false;

            child.stdout.on("data", (data) => {
              output += data.toString();
              if (
                data.toString().includes("Did you mean accounts current?") ||
                data.toString().includes("(Y/n)")
              ) {
                foundPrompt = true;
                setTimeout(() => {
                  child.stdin.write("n\n");
                }, 100);
              }
            });

            child.stderr.on("data", (data) => {
              errorOutput += data.toString();
            });

            // Wait for interactive prompt
            setTimeout(() => {
              child.stdin.write("accounts curren\n");
            }, 1000);

            setTimeout(() => {
              child.stdin.write("exit\n");
            }, 3000);

            child.on("exit", () => {
              const fullOutput = output + errorOutput;
              expect(foundPrompt).toBe(true);
              expect(fullOutput).toContain(
                "accounts curren is not an ably command",
              );
              resolve();
            });
          }),
        timeout,
      );

      it(
        "should execute command when confirmed with Y",
        async () =>
          new Promise<void>((resolve) => {
            const child = spawn("node", [binPath, "interactive"], {
              stdio: ["pipe", "pipe", "pipe"],
              env: {
                ...process.env,
                ABLY_INTERACTIVE_MODE: "true",
                ABLY_SUPPRESS_WELCOME: "1",
              },
            });

            let _output = "";
            let foundPrompt = false;
            let executedCommand = false;

            child.stdout.on("data", (data) => {
              _output += data.toString();

              if (
                data.toString().includes("Did you mean accounts current?") ||
                data.toString().includes("(Y/n)")
              ) {
                foundPrompt = true;
                setTimeout(() => {
                  child.stdin.write("y\n");
                }, 100);
              }

              // Check for various outputs that indicate the command was executed
              const output = data.toString();
              if (
                output.includes("Account:") ||
                output.includes("Show the current Ably account") ||
                output.includes("No access token provided") ||
                output.includes("accounts current") ||
                output.includes("No account currently selected") ||
                output.includes("You are not logged in") ||
                output.includes("Authentication required") ||
                output.includes("Error:")
              ) {
                executedCommand = true;
              }
            });

            child.stderr.on("data", (data) => {
              _output += data.toString();

              const errorOutput = data.toString();
              if (
                errorOutput.includes("No access token provided") ||
                errorOutput.includes("No account currently selected") ||
                errorOutput.includes("You are not logged in") ||
                errorOutput.includes("Authentication required") ||
                errorOutput.includes("Error:")
              ) {
                executedCommand = true;
              }
            });

            // Wait for interactive prompt
            setTimeout(() => {
              child.stdin.write("accounts curren\n");
            }, 1000);

            // Give more time for command execution
            setTimeout(() => {
              child.stdin.write("exit\n");
            }, 4000);

            child.on("exit", (code) => {
              // Debug output for CI failures
              if (!foundPrompt || !executedCommand) {
                console.error("Test failed - Debug output:");
                console.error("foundPrompt:", foundPrompt);
                console.error("executedCommand:", executedCommand);
                console.error("Exit code:", code);
                console.error("Output received:", _output);
              }

              expect(foundPrompt).toBe(true);
              expect(executedCommand).toBe(true);
              resolve();
            });
          }),
        timeout,
      );
    });

    describe("Non-Interactive Mode", () => {
      it(
        'should show Y/N prompt for "accounts curren"',
        async () => {
          try {
            await execAsync(`node ${binPath} accounts curren`, {
              timeout: 2000,
            });
            expect.fail("Should have timed out");
          } catch (error: any) {
            const fullOutput = (error.stdout || "") + (error.stderr || "");
            expect(fullOutput).toContain("Did you mean accounts current?");
            expect(fullOutput).toContain("(Y/n)");
          }
        },
        timeout,
      );
    });
  });

  describe("Command List Display", () => {
    it(
      "should show available commands after declining suggestion",
      async () =>
        new Promise<void>((resolve) => {
          const child = spawn("node", [binPath, "interactive"], {
            stdio: ["pipe", "pipe", "pipe"],
            env: {
              ...process.env,
              ABLY_INTERACTIVE_MODE: "true",
              ABLY_SUPPRESS_WELCOME: "1",
            },
          });

          let output = "";
          let foundPrompt = false;
          let foundCommandsList = false;

          child.stdout.on("data", (data) => {
            output += data.toString();

            if (data.toString().includes("Did you mean accounts current?")) {
              foundPrompt = true;
              setTimeout(() => {
                child.stdin.write("n\n");
              }, 100);
            }

            if (
              data.toString().includes("accounts current") &&
              data.toString().includes("Show the current Ably account")
            ) {
              foundCommandsList = true;
            }
          });

          setTimeout(() => {
            child.stdin.write("accounts curren\n");
          }, 500);

          setTimeout(() => {
            child.stdin.write("exit\n");
          }, 2500);

          child.on("exit", () => {
            expect(foundPrompt).toBe(true);
            expect(foundCommandsList).toBe(true);
            expect(output).toContain("Ably accounts management commands:");
            resolve();
          });
        }),
      timeout,
    );

    it(
      "should show commands when no suggestion found",
      async () =>
        new Promise<void>((resolve) => {
          const child = spawn("node", [binPath, "interactive"], {
            stdio: ["pipe", "pipe", "pipe"],
            env: {
              ...process.env,
              ABLY_INTERACTIVE_MODE: "true",
              ABLY_SUPPRESS_WELCOME: "1",
            },
          });

          let output = "";
          let errorOutput = "";
          let foundCommandsList = false;

          child.stdout.on("data", (data) => {
            output += data.toString();
            if (
              data.toString().includes("accounts current") &&
              data.toString().includes("Show the current Ably account")
            ) {
              foundCommandsList = true;
            }
          });

          child.stderr.on("data", (data) => {
            errorOutput += data.toString();
          });

          setTimeout(() => {
            child.stdin.write("accounts xyz\n");
          }, 500);

          setTimeout(() => {
            child.stdin.write("exit\n");
          }, 1500);

          child.on("exit", () => {
            const fullOutput = output + errorOutput;
            expect(foundCommandsList).toBe(true);
            expect(fullOutput).toContain("Command accounts xyz not found");
            expect(fullOutput).toContain("Ably accounts management commands:");
            expect(fullOutput).not.toContain("(Y/n)");
            resolve();
          });
        }),
      timeout,
    );
  });

  describe("Consistent Behavior", () => {
    it(
      "should behave consistently between top-level and second-level commands",
      async () => {
        // Both should timeout waiting for Y/N prompt
        try {
          await execAsync(`node ${binPath} account current`, { timeout: 2000 });
          expect.fail("Top-level should have timed out");
        } catch (error: any) {
          expect(error.stdout + error.stderr).toContain("(Y/n)");
        }

        try {
          await execAsync(`node ${binPath} accounts curren`, { timeout: 2000 });
          expect.fail("Second-level should have timed out");
        } catch (error: any) {
          expect(error.stdout + error.stderr).toContain("(Y/n)");
        }
      },
      timeout,
    );
  });
});
