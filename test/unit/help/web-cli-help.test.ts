import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  MockInstance,
} from "vitest";
import { Config } from "@oclif/core";
import stripAnsi from "strip-ansi";

import CustomHelp from "../../../src/help.js";
import { ConfigManager } from "../../../src/services/config-manager.js";

function createMockConfig(commands: any[] = [], topics: any[] = []): Config {
  return {
    bin: "ably",
    root: "",
    dataDir: "",
    configDir: "",
    cacheDir: "",
    name: "@ably/cli",
    version: "0.8.1",
    pjson: {} as any,
    channel: "stable",
    commands: commands,
    topics: topics,
    findCommand: vi.fn().mockReturnValue(null),
    findTopic: vi.fn().mockReturnValue(null),
    runHook: vi.fn(),
    runCommand: vi.fn(),
    s3Url: "",
    s3Key: vi.fn(),
    valid: true,
    plugins: [],
    binPath: "",
    userAgent: "",
    shellEnabled: false,
    topicSeparator: " ",
    versionAdd: vi.fn(),
    scopedEnvVar: vi.fn(),
    scopedEnvVarTrue: vi.fn(),
    scopedEnvVarKey: vi.fn(),
  } as unknown as Config;
}

describe("CLI Help", function () {
  describe("Web CLI Help", function () {
    let originalEnv: NodeJS.ProcessEnv;
    let consoleLogStub: MockInstance<typeof console.log>;
    let _processExitStub: MockInstance<NodeJS.Process["exit"]>;
    let configManagerStub: Partial<ConfigManager>;

    beforeEach(function () {
      originalEnv = { ...process.env };

      // Stub console.log to capture output
      consoleLogStub = vi.spyOn(console, "log").mockImplementation(vi.fn());

      // Stub process.exit to prevent test runner from exiting
      _processExitStub = vi
        .spyOn(process, "exit")
        // @ts-expect-error TS-2534
        .mockImplementation((): never => {});

      // Stub ConfigManager
      configManagerStub = {
        getAccessToken: vi.fn(),
      } as Partial<ConfigManager>;

      // Enable Web CLI mode
      process.env.ABLY_WEB_CLI_MODE = "true";
    });

    afterEach(function () {
      process.env = originalEnv;
      vi.restoreAllMocks();
    });

    describe("formatRoot in Web CLI mode", function () {
      it("should show simplified help when no --help flag is provided", async function () {
        const mockConfig = createMockConfig();
        const help = new CustomHelp(mockConfig);

        // Stub the configManager property
        (help as any).configManager = configManagerStub;

        // Simulate no --help flag in argv
        process.argv = ["node", "ably"];

        await help.showRootHelp();

        expect(consoleLogStub).toHaveBeenCalledOnce();
        const output = stripAnsi(consoleLogStub.mock.calls[0][0]);

        // Should show COMMON COMMANDS section
        expect(output).toContain("COMMON COMMANDS");

        // Check for commands in tabular format (less brittle - just check key parts)
        expect(output).toContain("channels publish [channel] [message]");
        expect(output).toContain("Publish a message");
        expect(output).toContain("channels subscribe [channel]");
        expect(output).toContain("Subscribe to a channel");

        // Should show channels:logs command for authenticated users
        expect(output).toContain("channels logs");
        expect(output).toContain("View live channel events");

        // Check for help instructions (less brittle - just check key parts)
        expect(output).toContain("Type");
        expect(output).toContain("help");
        expect(output).toContain("complete list of commands");

        // Should NOT show the full COMMANDS list section (with topic lists)
        expect(output).not.toContain("accounts");
        expect(output).not.toContain("apps");
      });

      it("should show full command list when --help flag is provided", async function () {
        const mockCommands: any[] = [];
        const mockTopics = [
          {
            name: "channels",
            description: "Interact with channels",
            hidden: false,
          },
          { name: "rooms", description: "Interact with rooms", hidden: false },
          {
            name: "spaces",
            description: "Interact with spaces",
            hidden: false,
          },
          // Restricted topics that should be filtered out
          { name: "accounts", description: "Manage accounts", hidden: false },
          { name: "config", description: "Manage config", hidden: false },
        ];

        const mockConfig = createMockConfig(mockCommands, mockTopics);
        const help = new CustomHelp(mockConfig);

        // Stub the configManager property
        (help as any).configManager = configManagerStub;

        // Simulate --help flag in argv
        process.argv = ["node", "ably", "--help"];

        await help.showRootHelp();

        expect(consoleLogStub).toHaveBeenCalledOnce();
        const output = stripAnsi(consoleLogStub.mock.calls[0][0]);

        // Should show browser-based CLI title
        expect(output).toContain(
          "ably.com browser-based CLI for Pub/Sub, Chat and Spaces",
        );

        // Should show COMMANDS section
        expect(output).toContain("COMMANDS");

        // Should show allowed commands
        expect(output).toContain("channels");
        expect(output).toContain("rooms");
        expect(output).toContain("spaces");

        // Should show accounts topic (only specific subcommands are restricted in authenticated mode)
        expect(output).toContain("accounts");

        // Should NOT show config (wildcard restriction)
        expect(output).not.toContain("config");

        // Should NOT show COMMON COMMANDS section
        expect(output).not.toContain("COMMON COMMANDS");
      });

      it("should show full command list when -h flag is provided", async function () {
        const mockCommands = [
          {
            id: "channels",
            description: "Interact with channels",
            hidden: false,
          },
          { id: "help", description: "Get help", hidden: false },
        ];

        const mockConfig = createMockConfig(mockCommands);
        const help = new CustomHelp(mockConfig);

        // Stub the configManager property
        (help as any).configManager = configManagerStub;

        // Simulate -h flag in argv
        process.argv = ["node", "ably", "-h"];

        await help.showRootHelp();

        expect(consoleLogStub).toHaveBeenCalledOnce();
        const output = stripAnsi(consoleLogStub.mock.calls[0][0]);

        // Should show COMMANDS section
        expect(output).toContain("COMMANDS");
        expect(output).toContain("channels");
        expect(output).toContain("help");
      });

      it("should filter out wildcard restricted commands", async function () {
        const mockCommands: any[] = [];
        const mockTopics = [
          {
            name: "channels",
            description: "Interact with channels",
            hidden: false,
          },
          { name: "config", description: "Config command", hidden: false },
          { name: "mcp", description: "MCP command", hidden: false },
        ];

        const mockConfig = createMockConfig(mockCommands, mockTopics);
        const help = new CustomHelp(mockConfig);

        // Stub the configManager property
        (help as any).configManager = configManagerStub;

        // Simulate --help flag
        process.argv = ["node", "ably", "--help"];

        await help.showRootHelp();

        expect(consoleLogStub).toHaveBeenCalledOnce();
        const output = stripAnsi(consoleLogStub.mock.calls[0][0]);

        // Should show allowed command
        expect(output).toContain("channels");

        // Should NOT show commands matching wildcard patterns (config*, mcp*)
        expect(output).not.toContain("config");
        expect(output).not.toContain("mcp");
      });

      it("should hide channels:logs in anonymous mode", async function () {
        const mockConfig = createMockConfig();
        const help = new CustomHelp(mockConfig);

        // Stub the configManager property
        (help as any).configManager = configManagerStub;

        // Enable anonymous/restricted mode
        process.env.ABLY_ANONYMOUS_USER_MODE = "true";

        // Simulate no --help flag in argv
        process.argv = ["node", "ably"];

        await help.showRootHelp();

        expect(consoleLogStub).toHaveBeenCalledOnce();
        const output = stripAnsi(consoleLogStub.mock.calls[0][0]);

        // Should show COMMON COMMANDS section
        expect(output).toContain("COMMON COMMANDS");
        // Check for basic commands in tabular format
        expect(output).toContain("channels publish [channel] [message]");
        expect(output).toContain("Publish a message");
        expect(output).toContain("channels subscribe [channel]");
        expect(output).toContain("Subscribe to a channel");

        // Should NOT show channels:logs command for anonymous users
        expect(output).not.toContain("channels logs");
        expect(output).not.toContain("View live channel events");

        // Clean up
        delete process.env.ABLY_ANONYMOUS_USER_MODE;
      });

      // Note: Login prompt is not shown in web CLI mode, only in standard CLI mode
    });

    describe("formatCommand in Web CLI mode", function () {
      it("should show restriction message for restricted commands", function () {
        const mockConfig = createMockConfig();
        const help = new CustomHelp(mockConfig);

        // Stub the configManager property
        (help as any).configManager = configManagerStub;

        // Stub super.formatCommand to return a dummy help text
        vi.spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(help)),
          "formatCommand",
        ).mockReturnValue(
          "USAGE\n  $ ably accounts login\n\nDESCRIPTION\n  Login to your account",
        );

        const restrictedCommand = {
          id: "accounts:login",
          description: "Login to account",
          hidden: false,
        };

        const output = stripAnsi(help.formatCommand(restrictedCommand as any));

        expect(output).toContain(
          "This command is not available in the web CLI mode",
        );
        expect(output).toContain(
          "Please use the standalone CLI installation instead",
        );
      });

      it("should show normal help for allowed commands", function () {
        const mockConfig = createMockConfig();
        const help = new CustomHelp(mockConfig);

        // Stub the configManager property
        (help as any).configManager = configManagerStub;

        const allowedCommand = {
          id: "channels:publish",
          description: "Publish a message",
          hidden: false,
        };

        // Stub super.formatCommand for this specific test
        vi.spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(help)),
          "formatCommand",
        ).mockReturnValue("Normal command help");

        const output = help.formatCommand(allowedCommand as any);

        expect(output).toBe("Normal command help");
        expect(output).not.toContain("not available in the web CLI mode");
      });
    });

    describe("shouldDisplay in Web CLI mode", function () {
      it("should filter out restricted commands", function () {
        const mockConfig = createMockConfig();
        const help = new CustomHelp(mockConfig);

        // Stub the configManager property
        (help as any).configManager = configManagerStub;

        // Test restricted commands
        expect(help.shouldDisplay({ id: "accounts:login" } as any)).toBe(false);
        expect(help.shouldDisplay({ id: "config" } as any)).toBe(false);
        expect(help.shouldDisplay({ id: "mcp:start" } as any)).toBe(false);

        // Test allowed commands
        expect(help.shouldDisplay({ id: "channels:publish" } as any)).toBe(
          true,
        );
        expect(help.shouldDisplay({ id: "channels:subscribe" } as any)).toBe(
          true,
        );
        expect(help.shouldDisplay({ id: "channels:logs" } as any)).toBe(true); // Now allowed for authenticated users
        expect(help.shouldDisplay({ id: "rooms:get" } as any)).toBe(true);
        expect(help.shouldDisplay({ id: "help" } as any)).toBe(true);
      });
    });
  });

  describe("Standard CLI Help (non-Web mode)", function () {
    let originalEnv: NodeJS.ProcessEnv;
    let consoleLogStub: MockInstance<typeof console.log>;
    let _processExitStub: MockInstance<NodeJS.Process["exit"]>;

    beforeEach(function () {
      originalEnv = { ...process.env };

      // Stub console.log to capture output
      consoleLogStub = vi.spyOn(console, "log").mockImplementation(vi.fn());

      // Stub process.exit to prevent test runner from exiting
      _processExitStub = vi
        .spyOn(process, "exit")
        // @ts-expect-error TS-2534
        .mockImplementation((): never => {});

      // Disable Web CLI mode
      process.env.ABLY_WEB_CLI_MODE = "false";
    });

    afterEach(function () {
      process.env = originalEnv;
    });

    it("should show standard help with all commands", async function () {
      const mockCommands = [
        {
          id: "channels",
          description: "Interact with channels",
          hidden: false,
        },
        { id: "accounts", description: "Manage accounts", hidden: false },
        { id: "config", description: "Manage config", hidden: false },
      ];

      const mockConfig = createMockConfig(mockCommands);

      const help = new CustomHelp(mockConfig);

      // Stub the configManager property
      const standardConfigManagerStub = {
        getAccessToken: vi.fn(),
      } as Partial<ConfigManager>;
      (help as any).configManager = standardConfigManagerStub;

      await help.showRootHelp();

      expect(consoleLogStub).toHaveBeenCalledOnce();
      const output = stripAnsi(consoleLogStub.mock.calls[0][0]);

      // Should show standard CLI title
      expect(output).toContain("ably.com CLI for Pub/Sub, Chat and Spaces");

      // Should show all commands (no filtering)
      expect(output).toContain("channels");
      expect(output).toContain("accounts");
      expect(output).toContain("config");
    });
  });
});
