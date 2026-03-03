import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BaseTopicCommand } from "../../../src/base-topic-command.js";
import { Config } from "@oclif/core";

// Test implementation of BaseTopicCommand
class TestTopicCommand extends BaseTopicCommand {
  protected topicName = "test";
  protected commandGroup = "test management";
}

describe("BaseTopicCommand", () => {
  let logStub: ReturnType<typeof vi.fn>;
  let config: any;
  let command: TestTopicCommand;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    logStub = vi.fn();
    originalEnv = { ...process.env };

    // Mock config with commands
    config = {
      commands: [
        {
          id: "test:command1",
          hidden: false,
          load: async () => ({
            description: "Test command 1",
            hidden: false,
          }),
        },
        {
          id: "test:command2",
          hidden: false,
          load: async () => ({
            description: "Test command 2",
            hidden: false,
          }),
        },
        {
          id: "test:hidden",
          hidden: true,
          load: async () => ({
            description: "Hidden command",
            hidden: true,
          }),
        },
        {
          id: "other:command",
          hidden: false,
          load: async () => ({
            description: "Other topic command",
            hidden: false,
          }),
        },
      ],
    };

    command = new TestTopicCommand([], config as Config);
    command.log = logStub;
  });

  afterEach(function () {
    process.env = originalEnv;
  });

  it("should list all non-hidden sub-commands", async () => {
    await command.run();

    expect(logStub.mock.calls.length).toBeGreaterThan(0);
    expect(logStub).toHaveBeenCalledWith("Ably test management commands:");
    expect(logStub).toHaveBeenCalledWith(
      expect.stringMatching(/test command1.*Test command 1/),
    );
    expect(logStub).toHaveBeenCalledWith(
      expect.stringMatching(/test command2.*Test command 2/),
    );

    // Should not show hidden command
    expect(logStub).not.toHaveBeenCalledWith(expect.stringMatching(/hidden/));

    // Should not show other topic commands
    expect(logStub).not.toHaveBeenCalledWith(
      expect.stringMatching(/other:command/),
    );
  });

  it("should format output consistently", async () => {
    await command.run();

    // Check header
    expect(logStub.mock.calls[0][0]).toBe("Ably test management commands:");

    // Check empty line after header
    expect(logStub.mock.calls[1][0]).toBe("");

    // Check footer
    const lastCalls = logStub.mock.calls.slice(-2);
    expect(lastCalls[0][0]).toBe("");
    expect(lastCalls[1][0]).toContain("Run `");
    expect(lastCalls[1][0]).toContain("ably test COMMAND --help");
  });

  it("should handle commands that fail to load", async () => {
    // Add a command that throws on load
    config.commands.push({
      id: "test:error",
      hidden: false,
      load: async () => {
        throw new Error("Failed to load");
      },
    });

    // Should not throw
    let error: Error | undefined;
    try {
      await command.run();
    } catch (error_) {
      error = error_ as Error;
    }
    expect(error).toBeUndefined();

    // Should still show other commands
    expect(logStub).toHaveBeenCalledWith(
      expect.stringMatching(/test command1/),
    );
    expect(logStub).toHaveBeenCalledWith(
      expect.stringMatching(/test command2/),
    );
  });

  it("should sort commands alphabetically", async () => {
    // Add commands in non-alphabetical order
    config.commands = [
      {
        id: "test:zebra",
        hidden: false,
        load: async () => ({ description: "Zebra command", hidden: false }),
      },
      {
        id: "test:alpha",
        hidden: false,
        load: async () => ({ description: "Alpha command", hidden: false }),
      },
      {
        id: "test:beta",
        hidden: false,
        load: async () => ({ description: "Beta command", hidden: false }),
      },
    ];

    await command.run();

    const calls = logStub.mock.calls;
    const commandCalls = calls.filter(
      (call) =>
        call[0].includes("test alpha") ||
        call[0].includes("test beta") ||
        call[0].includes("test zebra"),
    );

    expect(commandCalls[0][0]).toMatch(/test alpha/);
    expect(commandCalls[1][0]).toMatch(/test beta/);
    expect(commandCalls[2][0]).toMatch(/test zebra/);
  });

  it("should handle empty command list gracefully", async () => {
    config.commands = [];

    await command.run();

    expect(logStub).toHaveBeenCalledWith("Ably test management commands:");
    expect(logStub).toHaveBeenCalledWith("");
    expect(logStub).toHaveBeenCalledWith("  No commands found.");
  });

  it("should replace colons with spaces in command IDs", async () => {
    await command.run();

    // Should show "test command1" not "test:command1"
    expect(logStub).toHaveBeenCalledWith(
      expect.stringMatching(/test command1/),
    );
    expect(logStub).not.toHaveBeenCalledWith(
      expect.stringMatching(/test:command1/),
    );
  });

  it("should pad command names for alignment", async () => {
    config.commands = [
      {
        id: "test:a",
        hidden: false,
        load: async () => ({ description: "Short", hidden: false }),
      },
      {
        id: "test:very-long-command-name",
        hidden: false,
        load: async () => ({ description: "Long", hidden: false }),
      },
    ];

    await command.run();

    const calls = logStub.mock.calls;
    const commandCalls = calls.filter(
      (call) =>
        call[0].includes(" - ") &&
        (call[0].includes("Short") || call[0].includes("Long")),
    );

    // Both commands should be aligned
    expect(commandCalls).toHaveLength(2);
    commandCalls.forEach((call) => {
      const dashIndex = call[0].indexOf(" - ");
      expect(dashIndex).toBeGreaterThan(0);
    });
  });

  it("should handle commands with no description", async () => {
    config.commands = [
      {
        id: "test:no-desc",
        hidden: false,
        load: async () => ({ hidden: false }),
      },
    ];

    await command.run();

    expect(logStub).toHaveBeenCalledWith(
      expect.stringMatching(/test no-desc.*-\s*$/),
    );
  });

  it("should respect command-level hidden flag from loaded command", async () => {
    config.commands = [
      {
        id: "test:visible-config-hidden-loaded",
        hidden: false, // Not hidden in config
        load: async () => ({
          description: "Should be hidden",
          hidden: true, // But hidden when loaded
        }),
      },
    ];

    await command.run();

    expect(logStub).not.toHaveBeenCalledWith(
      expect.stringMatching(/Should be hidden/),
    );
  });

  describe("interactive mode", () => {
    beforeEach(() => {
      process.env.ABLY_INTERACTIVE_MODE = "true";
    });

    it("should strip ably prefix from command listings in interactive mode", async () => {
      await command.run();

      // Check that commands don't have "ably" prefix
      const calls = logStub.mock.calls;
      const commandCalls = calls.filter(
        (call) =>
          call[0].includes("test command1") ||
          call[0].includes("test command2"),
      );

      commandCalls.forEach((call) => {
        expect(call[0]).not.toContain("ably test command");
        expect(call[0]).toMatch(/^\s+.*test command/);
      });
    });

    it("should strip ably prefix from help instructions in interactive mode", async () => {
      await command.run();

      // Check footer help text
      const lastCallArgs = logStub.mock.calls.at(-1)![0];
      expect(lastCallArgs).toContain("Run `");
      expect(lastCallArgs).toContain("test COMMAND --help");
      expect(lastCallArgs).not.toContain("ably test COMMAND --help");
    });

    it("should show ably prefix in normal mode", async () => {
      delete process.env.ABLY_INTERACTIVE_MODE;

      await command.run();

      // Check that commands have "ably" prefix
      const calls = logStub.mock.calls;
      const commandCalls = calls.filter(
        (call) =>
          call[0].includes("test command1") ||
          call[0].includes("test command2"),
      );

      commandCalls.forEach((call) => {
        expect(call[0]).toContain("ably test command");
      });

      // Check footer
      const lastCallArgs = logStub.mock.calls.at(-1)![0];
      expect(lastCallArgs).toContain("ably test COMMAND --help");
    });
  });

  describe("Anonymous Mode Command Filtering", () => {
    beforeEach(() => {
      // Create auth-like command structure
      config.commands = [
        {
          id: "test:issue-token",
          hidden: false,
          load: async () => ({ description: "Issue a token", hidden: false }),
        },
        {
          id: "test:keys",
          hidden: false,
          load: async () => ({ description: "Key management", hidden: false }),
        },
        {
          id: "test:revoke-token",
          hidden: false,
          load: async () => ({ description: "Revoke a token", hidden: false }),
        },
      ];

      // Mock environment for testing - simulate auth:keys* and auth:revoke-token restrictions
      process.env.ABLY_WEB_CLI_MODE = "true";
      process.env.ABLY_ANONYMOUS_USER_MODE = "true";
    });

    it("should filter commands based on anonymous restrictions", async () => {
      // Override the test command to be auth command
      class AuthTopicCommand extends BaseTopicCommand {
        protected topicName = "auth";
        protected commandGroup = "authentication";
      }

      // Create auth command with proper restricted patterns
      const authCommand = new AuthTopicCommand([], config as Config);
      authCommand.log = logStub;

      // Update config to have auth commands
      config.commands = [
        {
          id: "auth:issue-ably-token",
          hidden: false,
          load: async () => ({
            description: "Issue Ably token",
            hidden: false,
          }),
        },
        {
          id: "auth:issue-jwt-token",
          hidden: false,
          load: async () => ({ description: "Issue JWT token", hidden: false }),
        },
        {
          id: "auth:keys",
          hidden: false,
          load: async () => ({ description: "Key management", hidden: false }),
        },
        {
          id: "auth:revoke-token",
          hidden: false,
          load: async () => ({ description: "Revoke a token", hidden: false }),
        },
      ];

      await authCommand.run();

      // Should show the allowed commands
      expect(logStub).toHaveBeenCalledWith(
        expect.stringMatching(/auth issue-ably-token/),
      );
      expect(logStub).toHaveBeenCalledWith(
        expect.stringMatching(/auth issue-jwt-token/),
      );

      // Should NOT show restricted commands
      expect(logStub).not.toHaveBeenCalledWith(
        expect.stringMatching(/auth keys/),
      );
      expect(logStub).not.toHaveBeenCalledWith(
        expect.stringMatching(/auth revoke-token/),
      );
    });

    it("should show all commands when not in anonymous mode", async () => {
      // Remove anonymous mode
      delete process.env.ABLY_ANONYMOUS_USER_MODE;

      await command.run();

      // All commands should be visible
      expect(logStub).toHaveBeenCalledWith(
        expect.stringMatching(/test issue-token/),
      );
      expect(logStub).toHaveBeenCalledWith(expect.stringMatching(/test keys/));
      expect(logStub).toHaveBeenCalledWith(
        expect.stringMatching(/test revoke-token/),
      );
    });

    it("should show all commands when not in web CLI mode", async () => {
      // Remove web CLI mode entirely
      delete process.env.ABLY_WEB_CLI_MODE;
      delete process.env.ABLY_ANONYMOUS_USER_MODE;

      await command.run();

      // All commands should be visible
      expect(logStub).toHaveBeenCalledWith(
        expect.stringMatching(/test issue-token/),
      );
      expect(logStub).toHaveBeenCalledWith(expect.stringMatching(/test keys/));
      expect(logStub).toHaveBeenCalledWith(
        expect.stringMatching(/test revoke-token/),
      );
    });
  });
});
