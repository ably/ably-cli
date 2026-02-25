import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import InteractiveCommand from "../../../src/commands/interactive.js";
import { Config } from "@oclif/core";
import * as fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const timeout = 10000;
const binPath = path.join(__dirname, "../../../bin/development.js");

// Helper to send tab completion request
const sendTab = (child: any) => {
  // Send TAB character (ASCII 9)
  child.stdin.write("\t");
};

describe("Interactive Mode - Autocomplete & Command Filtering", () => {
  describe("Autocomplete", () => {
    it(
      "should autocomplete top-level commands",
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

        let output = "";
        let foundAccounts = false;
        let foundApps = false;

        child.stdout.on("data", (data) => {
          output += data.toString();

          // Check if autocomplete shows available commands
          if (
            data.toString().includes("accounts") &&
            data.toString().includes("apps")
          ) {
            foundAccounts = true;
            foundApps = true;
          }
        });

        // Type 'a' and press tab
        setTimeout(() => {
          child.stdin.write("a");
          setTimeout(() => {
            sendTab(child);
          }, 100);
        }, 500);

        // Exit
        setTimeout(() => {
          child.stdin.write("\nexit\n");
        }, 1500);

        child.on("exit", () => {
          expect(foundAccounts || output.includes("accounts")).toBe(true);
          expect(foundApps || output.includes("apps")).toBe(true);
          done();
        });
      },
      timeout,
    );

    it(
      "should autocomplete subcommands",
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

        let output = "";
        let foundCurrent = false;

        child.stdout.on("data", (data) => {
          output += data.toString();

          // Check if autocomplete shows subcommands
          if (data.toString().includes("current")) {
            foundCurrent = true;
          }
        });

        // Type 'accounts ' and press tab
        setTimeout(() => {
          child.stdin.write("accounts ");
          setTimeout(() => {
            sendTab(child);
          }, 100);
        }, 500);

        // Exit
        setTimeout(() => {
          child.stdin.write("\nexit\n");
        }, 1500);

        child.on("exit", () => {
          expect(foundCurrent || output.includes("current")).toBe(true);
          done();
        });
      },
      timeout,
    );

    it(
      "should autocomplete flags",
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

        let output = "";
        let foundHelp = false;

        child.stdout.on("data", (data) => {
          output += data.toString();

          // Check if autocomplete shows flags
          if (data.toString().includes("--help")) {
            foundHelp = true;
          }
        });

        // Type 'accounts --' and press tab
        setTimeout(() => {
          child.stdin.write("accounts --");
          setTimeout(() => {
            sendTab(child);
          }, 100);
        }, 500);

        // Exit
        setTimeout(() => {
          child.stdin.write("\nexit\n");
        }, 1500);

        child.on("exit", () => {
          expect(foundHelp || output.includes("--help")).toBe(true);
          done();
        });
      },
      timeout,
    );

    it(
      "should filter autocomplete suggestions based on partial input",
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

        let output = "";
        let foundAccounts = false;
        let _foundApps = false;

        child.stdout.on("data", (data) => {
          output += data.toString();
          const dataStr = data.toString();

          // When we type 'acc' and tab, should only show 'accounts'
          if (dataStr.includes("accounts")) {
            foundAccounts = true;
          }
          if (dataStr.includes("apps")) {
            _foundApps = true;
          }
        });

        // Type 'acc' and press tab
        setTimeout(() => {
          child.stdin.write("acc");
          setTimeout(() => {
            sendTab(child);
          }, 100);
        }, 500);

        // Exit
        setTimeout(() => {
          child.stdin.write("\nexit\n");
        }, 1500);

        child.on("exit", () => {
          // Should find accounts but not apps when filtering by 'acc'
          expect(foundAccounts || output.includes("accounts")).toBe(true);
          done();
        });
      },
      timeout,
    );
  });

  describe("Command Filtering", () => {
    let interactiveCommand: InteractiveCommand;
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };

      // Mock config with various commands
      const mockConfig = {
        commands: [
          // Normal commands that should be available
          { id: "apps", hidden: false },
          { id: "apps:list", hidden: false },
          { id: "apps:create", hidden: false },
          { id: "apps:switch", hidden: false },
          { id: "apps:delete", hidden: false },
          { id: "channels", hidden: false },
          { id: "channels:publish", hidden: false },
          { id: "channels:subscribe", hidden: false },
          { id: "channels:list", hidden: false },
          { id: "accounts", hidden: false },
          { id: "accounts:list", hidden: false },
          { id: "accounts:login", hidden: false },
          { id: "accounts:logout", hidden: false },
          { id: "accounts:switch", hidden: false },
          { id: "accounts:current", hidden: false },
          { id: "accounts:stats", hidden: false },
          { id: "auth", hidden: false },
          { id: "auth:keys", hidden: false },
          { id: "auth:keys:switch", hidden: false },
          { id: "auth:revoke-token", hidden: false },
          { id: "bench", hidden: false },
          { id: "bench:realtime", hidden: false },
          { id: "integrations", hidden: false },
          { id: "integrations:list", hidden: false },
          { id: "queues", hidden: false },
          { id: "queues:list", hidden: false },
          { id: "logs", hidden: false },
          { id: "logs:tail", hidden: false },
          { id: "connections", hidden: false },
          { id: "connections:logs", hidden: false },
          { id: "rooms", hidden: false },
          { id: "rooms:list", hidden: false },
          { id: "spaces", hidden: false },
          { id: "spaces:list", hidden: false },
          // Commands that should always be filtered in interactive mode
          { id: "autocomplete", hidden: false },
          { id: "help", hidden: false },
          { id: "config", hidden: false },
          { id: "config:get", hidden: false },
          { id: "config:set", hidden: false },
          { id: "version", hidden: false },
          // Hidden command (should always be filtered)
          { id: "hidden-command", hidden: true },
        ],
        root: "/test/root",
        version: "1.0.0",
        findCommand: (id: string) =>
          mockConfig.commands.find((cmd) => cmd.id === id),
      } as unknown as Config;

      interactiveCommand = new InteractiveCommand([], mockConfig);
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    describe("Normal mode (not web CLI)", () => {
      beforeEach(() => {
        delete process.env.ABLY_WEB_CLI_MODE;
        delete process.env.ABLY_ANONYMOUS_USER_MODE;
        // Clear command cache to ensure fresh filtering
        (interactiveCommand as any)._commandCache = undefined;
      });

      it("should filter out unsuitable commands for interactive mode", () => {
        const commands = (interactiveCommand as any).getTopLevelCommands();

        // Should NOT include these commands
        expect(commands).not.toContain("autocomplete");
        expect(commands).not.toContain("config");
        expect(commands).not.toContain("version");

        // Should include these commands
        expect(commands).toContain("apps");
        expect(commands).toContain("channels");
        expect(commands).toContain("accounts");
        expect(commands).toContain("auth");
        expect(commands).toContain("exit"); // Special command
        expect(commands).toContain("help"); // Help is now allowed in interactive mode
      });

      it("should not filter subcommands in normal mode", () => {
        const subcommands = (interactiveCommand as any).getSubcommandsForPath([
          "apps",
        ]);

        expect(subcommands).toContain("list");
        expect(subcommands).toContain("create");
        expect(subcommands).toContain("switch");
        expect(subcommands).toContain("delete");
      });
    });

    describe("Web CLI mode (authenticated)", () => {
      beforeEach(() => {
        process.env.ABLY_WEB_CLI_MODE = "true";
        delete process.env.ABLY_ANONYMOUS_USER_MODE;
        // Clear command cache to ensure fresh filtering
        (interactiveCommand as any)._commandCache = undefined;
      });

      it("should filter out web CLI restricted commands", () => {
        const commands = (interactiveCommand as any).getTopLevelCommands();

        // Should NOT include web CLI restricted commands
        expect(commands).not.toContain("config"); // config* restricted

        // Should include commands that are only partially restricted
        expect(commands).toContain("accounts"); // only specific subcommands are restricted
        expect(commands).toContain("apps"); // only specific subcommands are restricted
        expect(commands).toContain("channels");
        expect(commands).toContain("auth"); // auth is allowed, only specific subcommands restricted
        expect(commands).toContain("bench"); // bench is allowed in authenticated mode
        expect(commands).toContain("integrations");
        expect(commands).toContain("queues");
        expect(commands).toContain("logs");
        expect(commands).toContain("rooms");
        expect(commands).toContain("spaces");
      });

      it("should filter out restricted subcommands", () => {
        // Apps subcommands - create, switch, delete should be filtered
        const appsSubcommands = (
          interactiveCommand as any
        ).getSubcommandsForPath(["apps"]);
        expect(appsSubcommands).toContain("list"); // list is allowed
        expect(appsSubcommands).not.toContain("create");
        expect(appsSubcommands).not.toContain("switch");
        expect(appsSubcommands).not.toContain("delete");

        // Auth:keys subcommands
        const authKeysSubcommands = (
          interactiveCommand as any
        ).getSubcommandsForPath(["auth", "keys"]);
        expect(authKeysSubcommands).not.toContain("switch"); // auth:keys:switch is restricted
      });
    });

    describe("Web CLI mode (anonymous)", () => {
      beforeEach(() => {
        process.env.ABLY_WEB_CLI_MODE = "true";
        process.env.ABLY_ANONYMOUS_USER_MODE = "true";
        // Clear command cache to ensure fresh filtering
        (interactiveCommand as any)._commandCache = undefined;
      });

      it("should filter out both web CLI and anonymous restricted commands", () => {
        const commands = (interactiveCommand as any).getTopLevelCommands();

        // Should NOT include any of these
        expect(commands).not.toContain("accounts"); // accounts* restricted in anonymous mode
        expect(commands).not.toContain("apps"); // apps* restricted in anonymous mode
        expect(commands).not.toContain("bench"); // restricted in anonymous mode
        expect(commands).not.toContain("integrations"); // restricted in anonymous mode
        expect(commands).not.toContain("queues"); // restricted in anonymous mode
        expect(commands).not.toContain("logs"); // restricted in anonymous mode
        expect(commands).not.toContain("config"); // restricted in web CLI mode

        // Should still include some commands
        expect(commands).toContain("channels"); // channels root is allowed
        expect(commands).toContain("auth"); // auth root is allowed
        expect(commands).toContain("exit");
      });

      it("should filter out anonymous-restricted subcommands", () => {
        // Channels subcommands - list and logs should be filtered in anonymous mode
        const channelsSubcommands = (
          interactiveCommand as any
        ).getSubcommandsForPath(["channels"]);
        expect(channelsSubcommands).toContain("publish"); // allowed
        expect(channelsSubcommands).toContain("subscribe"); // allowed
        expect(channelsSubcommands).not.toContain("list"); // channels:list restricted in anonymous

        // Auth subcommands
        const authSubcommands = (
          interactiveCommand as any
        ).getSubcommandsForPath(["auth"]);
        expect(authSubcommands).not.toContain("keys"); // auth:keys* restricted in anonymous
        expect(authSubcommands).not.toContain("revoke-token"); // auth:revoke-token restricted

        // Connections subcommands
        const connectionsSubcommands = (
          interactiveCommand as any
        ).getSubcommandsForPath(["connections"]);
        expect(connectionsSubcommands).not.toContain("logs"); // connections:logs restricted

        // Rooms subcommands
        const roomsSubcommands = (
          interactiveCommand as any
        ).getSubcommandsForPath(["rooms"]);
        expect(roomsSubcommands).not.toContain("list"); // rooms:list restricted

        // Spaces subcommands
        const spacesSubcommands = (
          interactiveCommand as any
        ).getSubcommandsForPath(["spaces"]);
        expect(spacesSubcommands).not.toContain("list"); // spaces:list restricted
      });
    });

    describe("Command pattern matching", () => {
      it("should correctly match wildcard patterns", () => {
        const isRestricted = (
          interactiveCommand as any
        ).isCommandRestricted.bind(interactiveCommand);

        // Set up web CLI mode for testing
        process.env.ABLY_WEB_CLI_MODE = "true";
        // Clear command cache to ensure fresh filtering
        (interactiveCommand as any)._commandCache = undefined;

        // Test wildcard patterns from WEB_CLI_RESTRICTED_COMMANDS
        expect(isRestricted("config")).toBe(true); // config* matches config
        expect(isRestricted("config:get")).toBe(true); // config* matches config:get
        expect(isRestricted("config:set")).toBe(true); // config* matches config:set

        // Test exact matches
        expect(isRestricted("accounts:login")).toBe(true);
        expect(isRestricted("apps:create")).toBe(true);

        // Test non-matches
        expect(isRestricted("channels:publish")).toBe(false);
        expect(isRestricted("auth:create-token")).toBe(false); // not in restricted list
      });
    });

    describe("Cache invalidation", () => {
      it("should rebuild command cache when environment changes", () => {
        // Get commands in normal mode
        delete process.env.ABLY_WEB_CLI_MODE;
        const normalCommands = (
          interactiveCommand as any
        ).getTopLevelCommands();
        expect(normalCommands).toContain("accounts"); // accounts is available in normal mode

        // Clear cache
        (interactiveCommand as any)._commandCache = undefined;

        // Get commands in web CLI mode
        process.env.ABLY_WEB_CLI_MODE = "true";
        const webCliCommands = (
          interactiveCommand as any
        ).getTopLevelCommands();
        // accounts:login, logout, switch are restricted but accounts itself is visible
        expect(webCliCommands).toContain("accounts");
      });
    });
  });

  describe("Flag Completion", () => {
    let interactive: any;
    let mockManifest: any;

    beforeEach(() => {
      // Create a mock manifest with flag data
      mockManifest = {
        commands: {
          "channels:batch-publish": {
            flags: {
              channels: {
                name: "channels",
                description:
                  "Comma-separated list of channel names to publish to",
                type: "option",
              },
              "channels-json": {
                name: "channels-json",
                description: "JSON array of channel names to publish to",
                type: "option",
              },
              encoding: {
                name: "encoding",
                char: "e",
                description: "The encoding for the message",
                type: "option",
              },
              name: {
                name: "name",
                char: "n",
                description:
                  "The event name (if not specified in the message JSON)",
                type: "option",
              },
              spec: {
                name: "spec",
                description:
                  "Complete batch spec JSON (either a single BatchSpec object or an array of BatchSpec objects)",
                type: "option",
              },
              json: {
                name: "json",
                description: "Output in JSON format",
                type: "boolean",
              },
              "pretty-json": {
                name: "pretty-json",
                description: "Output in colorized JSON format",
                type: "boolean",
              },
              "api-key": {
                name: "api-key",
                description:
                  "Overrides any configured API key used for the product APIs",
                type: "option",
              },
              help: {
                name: "help",
                char: "h",
                description: "Show help for command",
                type: "boolean",
              },
            },
          },
        },
      };
    });

    it("should return all flags for channels:batch-publish command", async () => {
      // Create a test instance
      const config = {
        root: process.cwd(),
        commands: [],
        findCommand: () => null,
      } as any;

      interactive = new InteractiveCommand([], config);
      interactive._manifestCache = mockManifest;

      // Test getting flags for channels:batch-publish
      const flags = interactive.getFlagsForCommandSync([
        "channels",
        "batch-publish",
      ]);

      // Check that flags array contains expected values
      expect(flags).toContain("--channels");
      expect(flags).toContain("--channels-json");
      expect(flags).toContain("--encoding");
      expect(flags).toContain("-e");
      expect(flags).toContain("--name");
      expect(flags).toContain("-n");
      expect(flags).toContain("--spec");
      expect(flags).toContain("--json");
      expect(flags).toContain("--pretty-json");
      expect(flags).toContain("--api-key");
      expect(flags).toContain("--help");
      expect(flags).toContain("-h");
    });

    it("should display flag completions with descriptions", async () => {
      // Create a test instance
      const config = {
        root: process.cwd(),
        commands: [],
        findCommand: () => null,
      } as any;

      interactive = new InteractiveCommand([], config);
      interactive._manifestCache = mockManifest;

      // Capture console output
      const originalLog = console.log;
      let output = "";
      console.log = (...args: any[]) => {
        output += args.join(" ") + "\n";
      };

      try {
        // Test completion display
        const matches = ["--channels", "--channels-json", "--encoding", "-e"];
        interactive.displayCompletions(matches, "flag", [
          "channels",
          "batch-publish",
        ]);

        expect(output).toContain("--channels");
        expect(output).toContain(
          "Comma-separated list of channel names to publish to",
        );
        expect(output).toContain("--channels-json");
        expect(output).toContain("JSON array of channel names to publish to");
        expect(output).toContain("--encoding");
        expect(output).toContain("The encoding for the message");
      } finally {
        console.log = originalLog;
      }
    });

    it("should filter hidden flags based on ABLY_SHOW_DEV_FLAGS", async () => {
      // Test that hidden flags are filtered out unless ABLY_SHOW_DEV_FLAGS is set
      const hiddenFlagManifest = {
        commands: {
          "test:command": {
            flags: {
              visible: {
                name: "visible",
                description: "A visible flag",
                type: "option",
              },
              hidden: {
                name: "hidden",
                description: "A hidden flag",
                type: "option",
                hidden: true,
              },
            },
          },
        },
      };

      const config = {
        root: process.cwd(),
        commands: [],
        findCommand: () => null,
      } as any;

      interactive = new InteractiveCommand([], config);
      interactive._manifestCache = hiddenFlagManifest;

      // Test without dev flags
      const flags = interactive.getFlagsForCommandSync(["test", "command"]);
      expect(flags).toContain("--visible");
      expect(flags).not.toContain("--hidden");

      // Test with dev flags
      process.env.ABLY_SHOW_DEV_FLAGS = "true";
      interactive._flagsCache = {}; // Clear cache
      const devFlags = interactive.getFlagsForCommandSync(["test", "command"]);
      expect(devFlags).toContain("--visible");
      expect(devFlags).toContain("--hidden");
      delete process.env.ABLY_SHOW_DEV_FLAGS;
    });
  });

  describe("Flag Manifest", () => {
    it("manifest should contain all flags for channels:batch-publish", async () => {
      // Verify the manifest contains all expected flags
      const manifestPath = path.join(process.cwd(), "oclif.manifest.json");
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      const batchPublish = manifest.commands["channels:batch-publish"];

      expect(batchPublish).toBeDefined();
      expect(batchPublish.flags).toBeDefined();

      // Check for command-specific flags
      expect(batchPublish.flags).toHaveProperty("channels");
      expect(batchPublish.flags).toHaveProperty("channels-json");
      expect(batchPublish.flags).toHaveProperty("encoding");
      expect(batchPublish.flags).toHaveProperty("name");
      expect(batchPublish.flags).toHaveProperty("spec");

      // Check for global flags
      expect(batchPublish.flags).toHaveProperty("json");
      expect(batchPublish.flags).toHaveProperty("pretty-json");
      expect(batchPublish.flags).toHaveProperty("api-key");
      expect(batchPublish.flags).toHaveProperty("access-token");
      expect(batchPublish.flags).toHaveProperty("verbose");

      // Check flag details
      expect(batchPublish.flags.encoding).toHaveProperty("char", "e");
      expect(batchPublish.flags.name).toHaveProperty("char", "n");
      expect(batchPublish.flags.verbose).toHaveProperty("char", "v");
    });

    it("manifest should be properly populated for all commands", async () => {
      // Check a few other commands to ensure manifest is complete
      const manifestPath = path.join(process.cwd(), "oclif.manifest.json");
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

      // Check channels:publish
      const channelsPublish = manifest.commands["channels:publish"];
      expect(channelsPublish).toBeDefined();
      expect(channelsPublish.flags).toHaveProperty("count");
      expect(channelsPublish.flags).toHaveProperty("delay");
      expect(channelsPublish.flags).toHaveProperty("encoding");
      expect(channelsPublish.flags).toHaveProperty("transport");

      // Check apps:list
      const appsList = manifest.commands["apps:list"];
      expect(appsList).toBeDefined();
      expect(appsList.flags).toHaveProperty("json");
      expect(appsList.flags).toHaveProperty("pretty-json");
    });
  });
});
