import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  MockInstance,
} from "vitest";
// import { Config } from '@oclif/core'; // Unused
import hook from "../../../src/hooks/command_not_found/did-you-mean.js";
import inquirer from "inquirer";
// import chalk from 'chalk'; // Unused

describe("Did You Mean Hook - Interactive Mode", function () {
  let config: any;
  let warnStub: ReturnType<typeof vi.fn>;
  let errorStub: ReturnType<typeof vi.fn>;
  let logStub: ReturnType<typeof vi.fn>;
  let consoleErrorStub: MockInstance<typeof console.error>;
  let consoleLogStub: MockInstance<typeof console.log>;
  let inquirerStub: MockInstance<typeof inquirer.prompt>;
  let runCommandStub: ReturnType<typeof vi.fn>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(function () {
    originalEnv = { ...process.env };

    // Set interactive mode
    process.env.ABLY_INTERACTIVE_MODE = "true";

    // Create stubs
    warnStub = vi.fn();
    errorStub = vi.fn();
    logStub = vi.fn();
    consoleErrorStub = vi.spyOn(console, "error");
    consoleLogStub = vi.spyOn(console, "log");
    runCommandStub = vi.fn();

    // Mock config
    config = {
      bin: "ably",
      commandIDs: ["channels:publish", "channels:subscribe", "apps:list"],
      runCommand: runCommandStub,
      findCommand: (id: string) => ({
        id,
        load: async () => ({
          id,
          description: `Command ${id}`,
          usage: id,
          args: {
            channel: { description: "Channel name" },
          },
        }),
      }),
    };

    // Mock inquirer to auto-confirm
    inquirerStub = vi
      .spyOn(inquirer, "prompt")
      .mockResolvedValue({ confirmed: true });
  });

  afterEach(function () {
    process.env = originalEnv;
  });

  describe("command not found handling", function () {
    it("should use console.log instead of this.warn in interactive mode", async function () {
      const context = {
        config,
        warn: warnStub,
        error: errorStub,
        log: logStub,
        exit: vi.fn(),
        debug: vi.fn(),
      };

      await hook.call(context, {
        id: "channels:pubish",
        argv: [],
        config,
        context,
      });

      // Should use console.log, not this.warn
      expect(warnStub).not.toHaveBeenCalled();
      expect(consoleLogStub).toHaveBeenCalled();

      // Find the warning message in console.log calls
      const warningCall = consoleLogStub.mock.calls.find(
        (call) =>
          call[0].includes("channels pubish") &&
          call[0].includes("is not an ably command"),
      );
      expect(warningCall).toBeDefined();
    });

    it("should not skip confirmation prompt in interactive mode", async function () {
      const context = {
        config,
        warn: warnStub,
        error: errorStub,
        log: logStub,
        exit: vi.fn(),
        debug: vi.fn(),
      };

      // Mock the global readline instance
      const mockReadline = {
        pause: vi.fn(),
        resume: vi.fn(),
        prompt: vi.fn(),
        listeners: vi.fn().mockReturnValue([]),
        removeAllListeners: vi.fn(),
        on: vi.fn(),
      };
      (globalThis as any).__ablyInteractiveReadline = mockReadline;

      await hook.call(context, {
        id: "channels:pubish",
        argv: [],
        config,
        context,
      });

      // Should show confirmation prompt
      expect(inquirerStub).toHaveBeenCalled();
      expect(inquirerStub.mock.calls[0][0][0].message).toContain(
        "Did you mean",
      );
      expect(inquirerStub.mock.calls[0][0][0].message).toContain(
        "channels publish",
      );

      // Should pause readline (resume happens asynchronously)
      expect(mockReadline.pause).toHaveBeenCalled();

      // Clean up
      delete (globalThis as any).__ablyInteractiveReadline;
    });

    it("should throw error instead of calling this.error when command fails", async function () {
      const context = {
        config,
        warn: warnStub,
        error: errorStub,
        log: logStub,
        exit: vi.fn(),
        debug: vi.fn(),
      };

      // Mock the global readline instance
      const mockReadline = {
        pause: vi.fn(),
        resume: vi.fn(),
        prompt: vi.fn(),
        listeners: vi.fn().mockReturnValue([]),
        removeAllListeners: vi.fn(),
        on: vi.fn(),
      };
      (globalThis as any).__ablyInteractiveReadline = mockReadline;

      // Make runCommand fail
      runCommandStub.mockImplementation(() => {
        throw new Error("Missing required arg: channel");
      });

      let thrownError: Error | undefined;
      try {
        await hook.call(context, {
          id: "channels:pubish",
          argv: [],
          config,
          context,
        });
      } catch (error) {
        thrownError = error as Error;
      }

      // Should throw error with oclif exit code
      expect(thrownError).toBeDefined();
      expect(thrownError?.message).toContain("Missing required arg: channel");
      expect((thrownError as any)?.oclif?.exit).toBeDefined();
      expect(errorStub).not.toHaveBeenCalled();

      // Clean up
      delete (globalThis as any).__ablyInteractiveReadline;
    });

    it("should use console.log for help output in interactive mode", async function () {
      const context = {
        config,
        warn: warnStub,
        error: errorStub,
        log: logStub,
        exit: vi.fn(),
        debug: vi.fn(),
      };

      // Mock the global readline instance
      const mockReadline = {
        pause: vi.fn(),
        resume: vi.fn(),
        prompt: vi.fn(),
        listeners: vi.fn().mockReturnValue([]),
        removeAllListeners: vi.fn(),
        on: vi.fn(),
      };
      (globalThis as any).__ablyInteractiveReadline = mockReadline;

      // Make runCommand fail with missing args
      const error = new Error(
        "Missing required arg: channel\nSee more help with --help",
      );
      runCommandStub.mockImplementation(() => {
        throw error;
      });

      try {
        await hook.call(context, {
          id: "channels:pubish",
          argv: [],
          config,
          context,
        });
      } catch {
        // Expected to throw
      }

      // Should use console.log for help, not this.log
      expect(logStub).not.toHaveBeenCalled();
      expect(consoleLogStub).toHaveBeenCalled();

      // Check help output doesn't include 'ably' prefix
      const helpOutput = consoleLogStub.mock.calls
        .map((call) => call[0])
        .join("\n");
      expect(helpOutput).toContain("USAGE");
      expect(helpOutput).toContain("$ channels publish"); // Space separated format
      expect(helpOutput).not.toContain("$ ably channels");
      expect(helpOutput).toContain("See more help with:");
      expect(helpOutput).toContain("channels publish --help");
      expect(helpOutput).not.toContain("ably channels publish --help");

      // Clean up
      delete (globalThis as any).__ablyInteractiveReadline;
    });

    it("should provide interactive-friendly error for unknown commands", async function () {
      const context = {
        config,
        warn: warnStub,
        error: errorStub,
        log: logStub,
        exit: vi.fn(),
        debug: vi.fn(),
      };

      let thrownError: Error | undefined;
      try {
        await hook.call(context, {
          id: "unknown:command",
          argv: [],
          config,
          context,
        });
      } catch (error) {
        thrownError = error as Error;
      }

      // Should throw with interactive-friendly message
      expect(thrownError).toBeDefined();
      expect(thrownError?.message).toContain(
        "Command unknown command not found. Run 'help' for a list of available commands.",
      );
      expect(thrownError?.message).not.toContain("ably --help");
      expect(errorStub).not.toHaveBeenCalled();
    });
  });

  describe("readline restoration", function () {
    it("should properly restore readline state after inquirer prompt", async function () {
      const context = {
        config,
        warn: warnStub,
        error: errorStub,
        log: logStub,
        exit: vi.fn(),
        debug: vi.fn(),
      };

      // Mock the global readline instance with more detailed state tracking
      const lineListeners = [vi.fn(), vi.fn()];
      const mockReadline = {
        pause: vi.fn(),
        resume: vi.fn(),
        prompt: vi.fn(),
        listeners: vi.fn().mockReturnValue(lineListeners),
        removeAllListeners: vi.fn(),
        on: vi.fn(),
        _refreshLine: vi.fn(),
      };
      (globalThis as any).__ablyInteractiveReadline = mockReadline;

      // Mock process.stdin for terminal state
      const originalIsRaw = process.stdin.isRaw;
      const originalIsTTY = process.stdin.isTTY;
      const originalSetRawMode = process.stdin.setRawMode;

      process.stdin.isRaw = false;
      process.stdin.isTTY = true;
      process.stdin.setRawMode = vi.fn().mockReturnValue(process.stdin);

      try {
        await hook.call(context, {
          id: "channels:pubish",
          argv: [],
          config,
          context,
        });

        // Wait for async restoration
        await new Promise((resolve) => setTimeout(resolve, 30));

        // Verify readline was paused during prompt
        expect(mockReadline.pause).toHaveBeenCalled();

        // Verify line listeners were temporarily removed and restored
        expect(mockReadline.removeAllListeners).toHaveBeenCalledWith("line");
        expect(mockReadline.on.mock.calls.length).toBe(lineListeners.length);
        lineListeners.forEach((listener, index) => {
          expect(mockReadline.on.mock.calls[index]).toEqual(["line", listener]);
        });

        // Verify readline was resumed
        expect(mockReadline.resume).toHaveBeenCalled();

        // Verify terminal state was restored
        expect(process.stdin.setRawMode).toHaveBeenCalledWith(false);
      } finally {
        // Clean up
        delete (globalThis as any).__ablyInteractiveReadline;
        process.stdin.isRaw = originalIsRaw;
        process.stdin.isTTY = originalIsTTY;
        process.stdin.setRawMode = originalSetRawMode;
      }
    });
  });

  describe("normal mode comparison", function () {
    it("should use normal error handling when not in interactive mode", async function () {
      // Disable interactive mode
      delete process.env.ABLY_INTERACTIVE_MODE;

      const context = {
        config,
        warn: warnStub,
        error: errorStub,
        log: logStub,
        exit: vi.fn(),
        debug: vi.fn(),
      };

      await hook.call(context, {
        id: "channels:pubish",
        argv: [],
        config,
        context,
      });

      // Should use this.warn in normal mode
      expect(warnStub).toHaveBeenCalled();
      expect(warnStub.mock.calls[0][0]).toContain("channels pubish");
      expect(warnStub.mock.calls[0][0]).toContain("is not an ably command");

      // Console.error should only be called by the stubs, not directly
      expect(consoleErrorStub).toHaveBeenCalledTimes(0);
    });
  });
});
