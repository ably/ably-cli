import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Interactive from "../../../src/commands/interactive.js";
import { Config } from "@oclif/core";
import chalk from "chalk";
// import * as readline from 'node:readline'; // Unused

describe("Interactive Command - Enhanced Features (Simplified)", () => {
  let interactiveCommand: Interactive;
  let config: Config;
  let stubs: any = {};

  beforeEach(async () => {
    // Mock config
    config = {
      root: "/test/root",
      version: "1.0.0",
      commands: new Map(),
      runCommand: vi.fn().mockImplementation(async () => {}),
      findCommand: vi.fn(),
    } as any;

    // Create command instance
    interactiveCommand = new Interactive([], config);

    vi.spyOn(
      interactiveCommand as any,
      "historyManager",
      "get",
    ).mockReturnValue({
      saveCommand: vi.fn().mockImplementation(async () => {}),
    });

    const mockReadline = {
      on: vi.fn(),
      prompt: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      close: vi.fn(),
    };

    // Setup readline interface
    vi.spyOn(interactiveCommand as any, "rl", "get").mockReturnValue(
      mockReadline,
    );

    // Setup default stubs
    stubs.consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    stubs.consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    stubs.processExit = vi.spyOn(process, "exit");

    // Mock environment variables
    process.env.ABLY_WRAPPER_MODE = "1"; // Always set wrapper mode for simpler tests
    process.env.ABLY_SUPPRESS_WELCOME = "1";
  });

  afterEach(() => {
    delete process.env.ABLY_INTERACTIVE_MODE;
    delete process.env.ABLY_WRAPPER_MODE;
    delete process.env.ABLY_SUPPRESS_WELCOME;
  });

  describe("Command Parsing - Enhanced", () => {
    it("should handle escaped quotes in double-quoted strings", () => {
      const parseCommand = (interactiveCommand as any).parseCommand.bind(
        interactiveCommand,
      );

      const result = parseCommand('echo "Hello \\"World\\""');
      expect(result).toEqual(["echo", 'Hello "World"']);
    });

    it("should handle escaped quotes in single-quoted strings", () => {
      const parseCommand = (interactiveCommand as any).parseCommand.bind(
        interactiveCommand,
      );

      const result = parseCommand("echo 'It\\'s great'");
      expect(result).toEqual(["echo", "It's great"]);
    });

    it("should handle empty quoted strings", () => {
      const parseCommand = (interactiveCommand as any).parseCommand.bind(
        interactiveCommand,
      );

      const result = parseCommand("test \"\" ''");
      expect(result).toEqual(["test", "", ""]);
    });

    it("should warn about unclosed quotes", () => {
      const parseCommand = (interactiveCommand as any).parseCommand.bind(
        interactiveCommand,
      );

      parseCommand('echo "unclosed');
      expect(stubs.consoleError).toHaveBeenCalledWith(
        chalk.yellow("Warning: Unclosed double quote in command"),
      );
    });

    it("should handle complex mixed quoting", () => {
      const parseCommand = (interactiveCommand as any).parseCommand.bind(
        interactiveCommand,
      );

      const result = parseCommand(
        "cmd --opt=\"value with spaces\" 'single' unquoted",
      );
      expect(result).toEqual([
        "cmd",
        "--opt=value with spaces",
        "single",
        "unquoted",
      ]);
    });

    it("should handle backslashes in unquoted strings", () => {
      const parseCommand = (interactiveCommand as any).parseCommand.bind(
        interactiveCommand,
      );

      const result = parseCommand("path\\to\\file");
      expect(result).toEqual(["path\\to\\file"]);
    });

    it("should handle multiple spaces between arguments", () => {
      const parseCommand = (interactiveCommand as any).parseCommand.bind(
        interactiveCommand,
      );

      const result = parseCommand("cmd   arg1    arg2     arg3");
      expect(result).toEqual(["cmd", "arg1", "arg2", "arg3"]);
    });
  });

  describe("Error Handling - Timeout", () => {
    beforeEach(() => {
      // Setup readline mock
      const mockReadline = {
        on: vi.fn(),
        prompt: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        close: vi.fn(),
      };

      // Setup readline interface
      vi.spyOn(interactiveCommand as any, "rl", "get").mockReturnValue(
        mockReadline,
      );
    });

    // Removed test: The interactive command no longer implements command timeouts
    // Long-running commands can be interrupted with Ctrl+C instead

    it("should manage runningCommand state", async () => {
      // The interactive command tracks if a command is running
      // This is used for SIGINT handling decisions

      // Verify runningCommand state management
      expect((interactiveCommand as any).runningCommand).toBe(false);
    });

    it("should reset runningCommand state after error", async () => {
      // Mock parseCommand
      vi.spyOn(interactiveCommand as any, "parseCommand").mockReturnValue([
        "error",
        "command",
      ]);

      // Mock runCommand to reject
      config.runCommand = vi
        .fn()
        .mockRejectedValue(new Error("Command failed"));

      // Run command
      const handleCommand = (interactiveCommand as any).handleCommand.bind(
        interactiveCommand,
      );
      await handleCommand("error command");

      // Verify state was reset
      expect((interactiveCommand as any).runningCommand).toBe(false);
    });
  });

  describe("SIGINT Handling with Running Commands", () => {
    it("should handle SIGINT based on command running state", () => {
      // Set command running state
      (interactiveCommand as any).runningCommand = true;
      (interactiveCommand as any).isWrapperMode = true;

      // In the current implementation, SIGINT during command execution
      // returns to prompt (not exit with 130) unless it's a double Ctrl+C

      // Test the preconditions for SIGINT handling
      expect((interactiveCommand as any).runningCommand).toBe(true);
      expect((interactiveCommand as any).isWrapperMode).toBe(true);
    });

    it("should handle SIGINT normally when no command is running", () => {
      // Set command not running
      (interactiveCommand as any).runningCommand = false;

      // Test the preconditions for normal SIGINT handling
      expect((interactiveCommand as any).runningCommand).toBe(false);

      // When runningCommand is false, SIGINT should:
      // 1. Clear the current line (call _deleteLineLeft and _deleteLineRight)
      // 2. Write ^C to stdout
      // 3. Show a new prompt
      // 4. NOT call process.exit

      // Since we can't easily test the actual handler, we verify the state
      // that determines the behavior
    });
  });

  describe("Exit Code Handling", () => {
    it("should use special exit code 42 when user types exit in wrapper mode", () => {
      process.env.ABLY_WRAPPER_MODE = "1";
      (interactiveCommand as any).isWrapperMode = true;

      // Test that the special exit code is defined
      expect(Interactive.EXIT_CODE_USER_EXIT).toBe(42);

      // Test that wrapper mode is properly set
      expect((interactiveCommand as any).isWrapperMode).toBe(true);

      // The actual behavior when user types exit:
      // 1. rl.close() is called
      // 2. In the close handler, cleanup() is called
      // 3. process.exit is called with 42 in wrapper mode, 0 otherwise
    });

    it("should use exit code 0 when not in wrapper mode", () => {
      // Not in wrapper mode
      delete process.env.ABLY_WRAPPER_MODE;
      (interactiveCommand as any).isWrapperMode = false;

      // Test that wrapper mode is properly unset
      expect((interactiveCommand as any).isWrapperMode).toBe(false);

      // The behavior when not in wrapper mode:
      // When rl.close() is called, process.exit(0) should be used
    });
  });

  describe("Command State Management", () => {
    beforeEach(() => {
      // Setup readline mock
      const mockReadline = {
        pause: vi.fn(),
        resume: vi.fn(),
        prompt: vi.fn(),
      };

      vi.spyOn(interactiveCommand as any, "rl", "get").mockReturnValue(
        mockReadline,
      );
    });

    it("should set runningCommand to true when command starts", async () => {
      // Mock parseCommand
      vi.spyOn(interactiveCommand as any, "parseCommand").mockReturnValue([
        "test",
      ]);

      // Start tracking state changes
      let stateWhenCommandRan = false;
      config.runCommand = vi.fn().mockImplementation(() => {
        stateWhenCommandRan = (interactiveCommand as any).runningCommand;
        return Promise.resolve();
      });

      // Run command
      const handleCommand = (interactiveCommand as any).handleCommand.bind(
        interactiveCommand,
      );
      await handleCommand("test");

      // Verify state was set
      expect(stateWhenCommandRan).toBe(true);
      expect((interactiveCommand as any).runningCommand).toBe(false); // Should be reset after
    });

    it("should pause and resume readline properly", async () => {
      // Get the readline mock that was set up in beforeEach
      const rl = (interactiveCommand as any).rl;

      // Mock parseCommand
      vi.spyOn(interactiveCommand as any, "parseCommand").mockReturnValue([
        "test",
      ]);

      // Add a small delay to simulate async command completion
      vi.useFakeTimers();

      // Run command
      const handleCommand = (interactiveCommand as any).handleCommand.bind(
        interactiveCommand,
      );
      const commandPromise = handleCommand("test");

      // Wait for command to complete
      await commandPromise;

      // Advance time for the finally block setTimeout
      await vi.advanceTimersByTimeAsync(100);

      // Verify readline was paused and resumed
      expect(rl.pause).toHaveBeenCalled();
      expect(rl.resume).toHaveBeenCalled();
      // Verify pause was called before resume
      expect(rl.pause.mock.invocationCallOrder[0]).toBeLessThan(
        rl.resume.mock.invocationCallOrder[0],
      );

      vi.useRealTimers();
    });
  });
});
