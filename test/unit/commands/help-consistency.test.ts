import { describe, it, expect, beforeAll } from "vitest";
import { exec, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Help Output Consistency", () => {
  const timeout = 10000;
  let binPath: string;

  beforeAll(() => {
    binPath = path.join(__dirname, "../../../bin/development.js");
  });

  describe("Topic Command Help (e.g., accounts --help)", () => {
    it(
      "should show COMMANDS section in non-interactive mode",
      async () => {
        const { stdout } = await execAsync(`node ${binPath} accounts --help`);

        // Check for COMMANDS section
        expect(stdout).toContain("COMMANDS");

        // Check for proper formatting with spaces (not colons)
        expect(stdout).toContain("ably accounts current");
        expect(stdout).toContain("ably accounts list");
        expect(stdout).toContain("ably accounts login");

        // Should NOT have colons
        expect(stdout).not.toContain("accounts:current");
        expect(stdout).not.toContain("accounts:list");
        expect(stdout).not.toContain("accounts:login");
      },
      timeout,
    );

    it(
      "should show COMMANDS section in interactive mode",
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

          child.stdout.on("data", (data) => {
            output += data.toString();
          });

          setTimeout(() => {
            child.stdin.write("accounts --help\n");
          }, 500);

          setTimeout(() => {
            child.stdin.write("exit\n");
          }, 1500);

          child.on("exit", () => {
            // Check for COMMANDS section
            expect(output).toContain("COMMANDS");

            // Check for proper formatting with spaces (not colons)
            expect(output).toContain("accounts current");
            expect(output).toContain("accounts list");
            expect(output).toContain("accounts login");

            // Should NOT have colons
            expect(output).not.toContain("accounts:current");
            expect(output).not.toContain("accounts:list");
            expect(output).not.toContain("accounts:login");

            // Should NOT have ably prefix in interactive mode
            expect(output).not.toMatch(/COMMANDS[\s\S]*ably accounts current/);

            resolve();
          });
        }),
      timeout,
    );

    it(
      "should have same sections in both modes",
      async () => {
        // Get non-interactive output
        const { stdout: nonInteractive } = await execAsync(
          `node ${binPath} accounts --help`,
        );

        // Get interactive output
        const interactiveOutput = await new Promise<string>((resolve) => {
          const child = spawn("node", [binPath, "interactive"], {
            stdio: ["pipe", "pipe", "pipe"],
            env: {
              ...process.env,
              ABLY_INTERACTIVE_MODE: "true",
              ABLY_SUPPRESS_WELCOME: "1",
            },
          });

          let output = "";

          child.stdout.on("data", (data) => {
            output += data.toString();
          });

          setTimeout(() => {
            child.stdin.write("accounts --help\n");
          }, 500);

          setTimeout(() => {
            child.stdin.write("exit\n");
          }, 1500);

          child.on("exit", () => {
            resolve(output);
          });
        });

        // Both should have these sections
        const sections = ["USAGE", "DESCRIPTION", "EXAMPLES", "COMMANDS"];

        sections.forEach((section) => {
          expect(nonInteractive).toContain(section);
          expect(interactiveOutput).toContain(section);
        });

        // Both should list the same commands (ignoring the ably prefix)
        const commands = [
          "current",
          "list",
          "login",
          "logout",
          "stats",
          "switch",
        ];

        commands.forEach((cmd) => {
          expect(nonInteractive).toContain(`accounts ${cmd}`);
          expect(interactiveOutput).toContain(`accounts ${cmd}`);
        });
      },
      timeout,
    );
  });

  describe("Support Command Suggestions", () => {
    it(
      'should suggest "support ask" when typing "support aska"',
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
          let foundSuggestion = false;

          child.stdout.on("data", (data) => {
            output += data.toString();
            if (data.toString().includes("Did you mean support ask?")) {
              foundSuggestion = true;
              setTimeout(() => {
                child.stdin.write("n\n");
              }, 100);
            }
          });

          setTimeout(() => {
            child.stdin.write("support aska\n");
          }, 500);

          setTimeout(() => {
            child.stdin.write("exit\n");
          }, 2000);

          child.on("exit", () => {
            expect(foundSuggestion).toBe(true);
            // When declining suggestion, topic commands show their help
            expect(output).toContain("Ably support commands:");
            expect(output).toContain("support ask");
            expect(output).toContain("support contact");
            expect(output).toContain("support info");
            resolve();
          });
        }),
      timeout,
    );
  });

  describe("Multiple Topic Commands", () => {
    it(
      "should show consistent help for different topic commands",
      async () => {
        // Test multiple topic commands with subcommands
        const topicsWithCommands = ["accounts", "apps", "channels"];

        for (const topic of topicsWithCommands) {
          const { stdout } = await execAsync(`node ${binPath} ${topic} --help`);

          // Should have standard sections
          expect(stdout).toContain("USAGE");
          expect(stdout).toContain("DESCRIPTION");
          expect(stdout).toContain("EXAMPLES");

          // Should have COMMANDS section for topics with subcommands
          expect(stdout).toContain("COMMANDS");
          // Commands should use spaces, not colons
          expect(stdout).not.toMatch(new RegExp(`${topic}:[a-z]+`));
        }
      },
      timeout,
    );
  });
});
