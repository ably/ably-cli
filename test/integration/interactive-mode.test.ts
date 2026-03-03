import { describe, it, expect, beforeAll } from "vitest";

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Interactive Mode Command Tests", function () {
  let binPath: string;

  beforeAll(function () {
    binPath = path.join(__dirname, "../../bin/development.js");
  });

  describe("Version Command in Interactive Mode", function () {
    it("should work as a command in interactive mode", function (done) {
      const child = spawn("node", [binPath, "interactive"], {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          ABLY_INTERACTIVE_MODE: "true",
          ABLY_SUPPRESS_WELCOME: "1",
        },
      });

      let output = "";
      let versionFound = false;

      child.stdout.on("data", (data) => {
        output += data.toString();
        if (data.toString().includes("Version:")) {
          versionFound = true;
          setTimeout(() => {
            child.stdin.write("exit\n");
          }, 100);
        }
      });

      setTimeout(() => {
        child.stdin.write("version\n");
      }, 500);

      child.on("exit", (code) => {
        expect(versionFound).toBe(true);
        expect(output).toContain("Version:");
        expect(code).toBe(0);
        done();
      });
    });

    it("should handle --version flag as global flag in interactive mode", function (done) {
      const child = spawn("node", [binPath, "interactive"], {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          ABLY_INTERACTIVE_MODE: "true",
          ABLY_SUPPRESS_WELCOME: "1",
        },
      });

      let output = "";
      let versionFound = false;

      child.stdout.on("data", (data) => {
        output += data.toString();
        if (data.toString().includes("Version:")) {
          versionFound = true;
          setTimeout(() => {
            child.stdin.write("exit\n");
          }, 100);
        }
      });

      setTimeout(() => {
        child.stdin.write("--version\n");
      }, 500);

      child.on("exit", () => {
        // --version flag is specially handled to show version
        expect(versionFound).toBe(true);
        expect(output).toContain("Version:");
        done();
      });
    });
  });

  describe("Interactive Unsuitable Commands", function () {
    const unsuitableCommands = ["autocomplete", "config"];

    for (const cmd of unsuitableCommands) {
      it(`should block ${cmd} command in interactive mode`, function (done) {
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
        let blockedMessage = false;

        child.stdout.on("data", (data) => {
          output += data.toString();
          if (data.toString().includes("not available in interactive mode")) {
            blockedMessage = true;
            setTimeout(() => {
              child.stdin.write("exit\n");
            }, 100);
          }
        });

        child.stderr.on("data", (data) => {
          errorOutput += data.toString();
          if (data.toString().includes("not available in interactive mode")) {
            blockedMessage = true;
            setTimeout(() => {
              child.stdin.write("exit\n");
            }, 100);
          }
        });

        setTimeout(() => {
          child.stdin.write(`${cmd}\n`);
        }, 500);

        // Fallback exit
        setTimeout(() => {
          if (child.exitCode === null) {
            child.stdin.write("exit\n");
          }
        }, 3000);

        child.on("exit", () => {
          const fullOutput = output + errorOutput;
          // Should either show "not available" or "command not found"
          if (
            !blockedMessage &&
            !/command.*not.*found|Unknown command/i.test(fullOutput)
          ) {
            console.log(`Test failed for ${cmd}:`);
            console.log("Output:", output);
            console.log("Error:", errorOutput);
          }
          expect(
            blockedMessage ||
              /command.*not.*found|Unknown command/i.test(fullOutput),
          ).toBe(true);
          done();
        });
      });
    }
  });

  describe("Ably Command Feedback", function () {
    it('should show helpful feedback when typing "ably" in interactive mode', function (done) {
      const child = spawn("node", [binPath, "interactive"], {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          ABLY_INTERACTIVE_MODE: "true",
          ABLY_SUPPRESS_WELCOME: "1",
        },
      });

      let output = "";
      let feedbackFound = false;

      child.stdout.on("data", (data) => {
        output += data.toString();
        if (data.toString().includes("You're already in interactive mode")) {
          feedbackFound = true;
          setTimeout(() => {
            child.stdin.write("exit\n");
          }, 100);
        }
      });

      setTimeout(() => {
        child.stdin.write("ably\n");
      }, 500);

      child.on("exit", () => {
        expect(feedbackFound).toBe(true);
        expect(output).toContain("You're already in interactive mode");
        expect(output).toContain("Type 'help' or press TAB");
        done();
      });
    });

    it('should not trigger feedback for commands containing "ably" as substring', function (done) {
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

      child.stdout.on("data", (data) => {
        output += data.toString();
      });

      child.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      setTimeout(() => {
        child.stdin.write("ablything\n");
      }, 500);

      setTimeout(() => {
        child.stdin.write("exit\n");
      }, 1500);

      child.on("exit", () => {
        // Should NOT show the interactive mode message
        expect(output).not.toContain("You're already in interactive mode");
        // Should show command not found instead
        const fullOutput = output + errorOutput;
        expect(fullOutput).toMatch(/command.*not.*found|Unknown command/i);
        done();
      });
    });
  });

  describe("Command Availability", function () {
    it("should have access to all regular commands", function (done) {
      const child = spawn("node", [binPath, "interactive"], {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          ABLY_INTERACTIVE_MODE: "true",
          ABLY_SUPPRESS_WELCOME: "1",
        },
      });

      let output = "";
      let helpFound = false;

      child.stdout.on("data", (data) => {
        output += data.toString();
        if (
          data.toString().includes("COMMANDS") &&
          data.toString().includes("channels")
        ) {
          helpFound = true;
          setTimeout(() => {
            child.stdin.write("exit\n");
          }, 100);
        }
      });

      setTimeout(() => {
        child.stdin.write("help\n");
      }, 500);

      child.on("exit", () => {
        expect(helpFound).toBe(true);
        // Check for key commands that should be available
        expect(output).toContain("channels");
        expect(output).toContain("accounts");
        expect(output).toContain("apps");
        expect(output).toContain("status");
        expect(output).toContain("support");
        done();
      });
    });
  });

  describe("Help Command Behavior", function () {
    it('should show help without "ably" prefix in interactive mode', function (done) {
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
        child.stdin.write("help channels\n");
      }, 500);

      setTimeout(() => {
        child.stdin.write("exit\n");
      }, 1500);

      child.on("exit", () => {
        // Should show channels help
        expect(output).toContain("Interact with Ably Pub/Sub channels");
        // Usage should not have "ably" prefix
        expect(output).toMatch(/ably>\s+channels/);
        expect(output).not.toMatch(/ably>\s+ably\s+channels/);
        done();
      });
    });

    it("should work with new help structure (no subcommands)", function (done) {
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

      child.stdout.on("data", (data) => {
        output += data.toString();
      });

      child.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      setTimeout(() => {
        // Try old help subcommand syntax - should not work
        child.stdin.write("help ask\n");
      }, 500);

      setTimeout(() => {
        child.stdin.write("exit\n");
      }, 1500);

      child.on("exit", () => {
        // Should not find "help ask" command
        const fullOutput = output + errorOutput;
        expect(fullOutput).toMatch(/command.*not.*found|Unknown command/i);
        done();
      });
    });
  });

  describe("Anonymous Mode Help Filtering", function () {
    it("should hide restricted commands in anonymous mode help output", function (done) {
      const child = spawn("node", [binPath, "interactive"], {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          ABLY_INTERACTIVE_MODE: "true",
          ABLY_WEB_CLI_MODE: "true",
          ABLY_ANONYMOUS_USER_MODE: "true",
          ABLY_SUPPRESS_WELCOME: "1",
        },
      });

      let output = "";
      let helpFound = false;

      child.stdout.on("data", (data) => {
        output += data.toString();
        if (data.toString().includes("COMMANDS")) {
          helpFound = true;
          setTimeout(() => {
            child.stdin.write("exit\n");
          }, 100);
        }
      });

      setTimeout(() => {
        child.stdin.write("help\n");
      }, 500);

      child.on("exit", () => {
        expect(helpFound).toBe(true);

        // Should show allowed commands
        expect(output).toContain("channels");
        expect(output).toContain("spaces");
        expect(output).toContain("rooms");

        // Should NOT show restricted commands like accounts, apps, bench, logs, etc.
        // Note: we check that these commands don't appear in the commands list
        // They might appear in command group names, but not as actual executable commands
        const lines = output.split("\n");
        const commandLines = lines.filter((line) => line.match(/^\s{2}\w+/)); // Command lines start with 2 spaces
        const commandsText = commandLines.join("\n");

        expect(commandsText).not.toMatch(/^\s{2}accounts/m);
        expect(commandsText).not.toMatch(/^\s{2}apps/m);
        expect(commandsText).not.toMatch(/^\s{2}bench/m);
        expect(commandsText).not.toMatch(/^\s{2}logs/m);
        expect(commandsText).not.toMatch(/^\s{2}integrations/m);
        expect(commandsText).not.toMatch(/^\s{2}queues/m);

        done();
      });
    });

    it("should show restricted message when trying to run anonymous restricted commands", function (done) {
      const child = spawn("node", [binPath, "interactive"], {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          ABLY_INTERACTIVE_MODE: "true",
          ABLY_WEB_CLI_MODE: "true",
          ABLY_ANONYMOUS_USER_MODE: "true",
          ABLY_SUPPRESS_WELCOME: "1",
        },
      });

      let output = "";
      let errorOutput = "";

      child.stdout.on("data", (data) => {
        output += data.toString();
      });

      child.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      setTimeout(() => {
        child.stdin.write("channels logs\n");
      }, 500);

      setTimeout(() => {
        child.stdin.write("exit\n");
      }, 1500);

      child.on("exit", () => {
        const fullOutput = output + errorOutput;
        // Should show anonymous restriction message
        expect(fullOutput).toContain("not available in anonymous mode");
        expect(fullOutput).toContain(
          "provide an access token to use this command",
        );
        done();
      });
    });

    it("should filter restricted subcommands in topic help output", function (done) {
      const child = spawn("node", [binPath, "interactive"], {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          ABLY_INTERACTIVE_MODE: "true",
          ABLY_WEB_CLI_MODE: "true",
          ABLY_ANONYMOUS_USER_MODE: "true",
          ABLY_SUPPRESS_WELCOME: "1",
        },
      });

      let output = "";

      child.stdout.on("data", (data) => {
        output += data.toString();
      });

      setTimeout(() => {
        child.stdin.write("auth\n");
      }, 500);

      setTimeout(() => {
        child.stdin.write("exit\n");
      }, 1500);

      child.on("exit", () => {
        // Should show auth commands but NOT auth keys or auth revoke-token
        expect(output).toContain("auth issue-ably-token");
        expect(output).toContain("auth issue-jwt-token");
        expect(output).not.toContain("auth keys");
        expect(output).not.toContain("auth revoke-token");
        done();
      });
    });
  });
});
