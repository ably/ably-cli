import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Accounts Command - Unknown Flag Handling", () => {
  const timeout = 10000;

  it(
    "should show subcommands when using unknown flag in interactive mode",
    (done) => {
      const child = spawn(
        "node",
        [path.join(__dirname, "../../../bin/development.js"), "interactive"],
        {
          stdio: ["pipe", "pipe", "pipe"],
          env: {
            ...process.env,
            ABLY_INTERACTIVE_MODE: "true",
            ABLY_SUPPRESS_WELCOME: "1",
          },
        },
      );

      let output = "";
      let errorOutput = "";

      child.stdout.on("data", (data) => {
        output += data.toString();
      });

      child.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      // Wait for interactive prompt
      setTimeout(() => {
        // Send accounts with unknown flag
        child.stdin.write("accounts --non-existing-flag\n");

        // Give time for command to execute
        setTimeout(() => {
          child.stdin.write("exit\n");
        }, 1000);
      }, 1000);

      child.on("exit", () => {
        const fullOutput = output + errorOutput;

        // Should show accounts command help with subcommands
        expect(fullOutput).toContain("Ably accounts management commands:");
        expect(fullOutput).toContain("accounts current");
        expect(fullOutput).toContain("accounts list");
        expect(fullOutput).toContain("accounts login");
        expect(fullOutput).toContain("Show the current Ably account");

        // Should not show error about unknown flag
        expect(fullOutput).not.toContain("Nonexistent flag");
        expect(fullOutput).not.toContain("Unknown flag");

        done();
      });
    },
    timeout,
  );

  it(
    "should show same output in interactive and non-interactive modes",
    (done) => {
      // First, run non-interactive command
      const nonInteractive = spawn(
        "node",
        [
          path.join(__dirname, "../../../bin/development.js"),
          "accounts",
          "--non-existing-flag",
        ],
        {
          stdio: ["pipe", "pipe", "pipe"],
        },
      );

      let nonInteractiveOutput = "";

      nonInteractive.stdout.on("data", (data) => {
        nonInteractiveOutput += data.toString();
      });

      nonInteractive.stderr.on("data", (data) => {
        nonInteractiveOutput += data.toString();
      });

      nonInteractive.on("exit", () => {
        // Now run interactive command
        const interactive = spawn(
          "node",
          [path.join(__dirname, "../../../bin/development.js"), "interactive"],
          {
            stdio: ["pipe", "pipe", "pipe"],
            env: {
              ...process.env,
              ABLY_INTERACTIVE_MODE: "true",
              ABLY_SUPPRESS_WELCOME: "1",
            },
          },
        );

        let interactiveOutput = "";

        interactive.stdout.on("data", (data) => {
          interactiveOutput += data.toString();
        });

        interactive.stderr.on("data", (data) => {
          interactiveOutput += data.toString();
        });

        // Wait for interactive prompt
        setTimeout(() => {
          interactive.stdin.write("accounts --non-existing-flag\n");

          // Give time for command to execute
          setTimeout(() => {
            interactive.stdin.write("exit\n");
          }, 1000);
        }, 1000);

        interactive.on("exit", () => {
          // Both should show the accounts management commands
          expect(nonInteractiveOutput).toContain(
            "Ably accounts management commands:",
          );
          expect(interactiveOutput).toContain(
            "Ably accounts management commands:",
          );

          // Both should list the same subcommands
          expect(nonInteractiveOutput).toContain("accounts current");
          expect(interactiveOutput).toContain("accounts current");

          expect(nonInteractiveOutput).toContain("accounts list");
          expect(interactiveOutput).toContain("accounts list");

          done();
        });
      });
    },
    timeout,
  );
});
