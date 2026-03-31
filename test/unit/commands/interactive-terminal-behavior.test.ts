import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Interactive from "../../../src/commands/interactive.js";
import { Readable, Writable } from "node:stream";
import * as readline from "node:readline";
import { type Config } from "@oclif/core";

type InteractiveInternals = {
  rl: readline.Interface & {
    line: string;
    cursor: number;
    history: string[];
  };
  historySearch: {
    active: boolean;
    searchTerm: string;
    matches: unknown[];
    currentIndex: number;
    originalCursorPos: number;
  };
  completer: (line: string) => [string[], string];
};

describe("Interactive Mode - Terminal Behavior Unit Tests", () => {
  let mockInput: Readable;
  let mockOutput: Writable;
  let _outputData: string;
  let originalStdin: typeof process.stdin;
  let originalStdout: typeof process.stdout;
  let exitStub: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    _outputData = "";

    // Create mock streams
    mockInput = new Readable({
      read() {},
    });

    // Add properties needed by the interactive command
    (mockInput as unknown as { isTTY: boolean }).isTTY = true;
    (
      mockInput as unknown as { setRawMode: ReturnType<typeof vi.fn> }
    ).setRawMode = vi.fn().mockReturnValue(mockInput);

    // Enable keypress events on our mock input
    readline.emitKeypressEvents(mockInput);

    mockOutput = new Writable({
      write(chunk: Buffer | string, _encoding: string, callback: () => void) {
        _outputData += chunk.toString();
        callback();
        return true;
      },
    });

    // Add properties needed by output
    (mockOutput as unknown as { isTTY: boolean }).isTTY = true;

    // Store originals
    originalStdin = process.stdin;
    originalStdout = process.stdout;

    // Replace process.stdin and process.stdout
    Object.defineProperty(process, "stdin", {
      value: mockInput,
      configurable: true,
    });

    Object.defineProperty(process, "stdout", {
      value: mockOutput,
      configurable: true,
    });

    exitStub = vi
      .spyOn(process, "exit")
      // @ts-expect-error Because we're mocking process.exit which is a never.
      .mockImplementation((_: number): never => {});

    // Stub console methods
    vi.spyOn(console, "log");
    vi.spyOn(console, "error");

    // Suppress welcome message for tests
    process.env.ABLY_SUPPRESS_WELCOME = "true";
  });

  afterEach(() => {
    // Restore process streams
    Object.defineProperty(process, "stdin", {
      value: originalStdin,
      configurable: true,
    });

    Object.defineProperty(process, "stdout", {
      value: originalStdout,
      configurable: true,
    });

    delete process.env.ABLY_SUPPRESS_WELCOME;
    vi.restoreAllMocks();
  });

  const simulateKeypress = (
    str: string | null,
    key: { ctrl?: boolean; name?: string; meta?: boolean; shift?: boolean },
  ) => {
    mockInput.emit("keypress", str || "", key);
  };

  it("should handle autocomplete during history search correctly", async () => {
    const cmd = new Interactive([], {} as unknown as Config);
    cmd.config = {
      version: "1.0.0",
      commands: [
        {
          id: "channels",
          description: "Manage channels",
          flags: {},
          args: {},
          run: vi.fn(),
        },
      ],
      runCommand: vi.fn(),
      findCommand: vi.fn(),
      root: "/test",
    } as unknown as Config;

    await cmd.run();

    const _rl = (cmd as unknown as InteractiveInternals).rl;

    // Enter history search mode
    simulateKeypress(null, { ctrl: true, name: "r" });

    // Verify autocomplete is disabled during search
    const completer = (cmd as unknown as InteractiveInternals).completer.bind(
      cmd,
    );
    const result = completer("ch");

    expect(result).toEqual([[], "ch"]);

    // Exit search mode
    simulateKeypress(null, { name: "escape" });

    // Verify autocomplete works again
    const result2 = completer("ch");
    expect(result2[0]).toContain("channels");
  });

  it("should maintain cursor position across operations", async () => {
    const cmd = new Interactive([], {} as unknown as Config);
    cmd.config = {
      version: "1.0.0",
      commands: [],
      runCommand: vi.fn(),
      findCommand: vi.fn(),
      root: "/test",
    } as unknown as Config;

    await cmd.run();

    const rl = (cmd as unknown as InteractiveInternals).rl;

    // Set initial state
    rl.line = "test command";
    rl.cursor = 5; // cursor at 'test |command'

    // Enter and exit history search
    simulateKeypress(null, { ctrl: true, name: "r" });

    const historySearch = (cmd as unknown as InteractiveInternals)
      .historySearch;
    expect(historySearch.originalCursorPos).toBe(5);

    // Cancel search
    simulateKeypress(null, { name: "escape" });

    // Cursor should be restored
    expect(rl.cursor).toBe(5);
  });

  it("should handle empty history gracefully", async () => {
    const cmd = new Interactive([], {} as unknown as Config);
    cmd.config = {
      version: "1.0.0",
      commands: [],
      runCommand: vi.fn(),
      findCommand: vi.fn(),
      root: "/test",
    } as unknown as Config;

    await cmd.run();

    const rl = (cmd as unknown as InteractiveInternals).rl;

    // Ensure history is empty
    rl.history = [];

    // Try history navigation
    const originalLine = "current input";
    rl.line = originalLine;

    // Simulate up arrow - should do nothing
    rl.emit("history", 1);

    // Line should remain unchanged
    expect(rl.line).toBe(originalLine);

    // Try history search
    simulateKeypress(null, { ctrl: true, name: "r" });
    simulateKeypress("t", { name: "t" });

    const historySearch = (cmd as unknown as InteractiveInternals)
      .historySearch;
    expect(historySearch.matches.length).toBe(0);
  });

  it("should handle rapid key sequences", async () => {
    const cmd = new Interactive([], {} as unknown as Config);
    cmd.config = {
      version: "1.0.0",
      commands: [
        {
          id: "test",
          description: "Test command",
          flags: {},
          args: {},
          run: vi.fn(),
        },
      ],
      runCommand: vi.fn(),
      findCommand: vi.fn(),
      root: "/test",
    } as unknown as Config;

    await cmd.run();

    const rl = (cmd as unknown as InteractiveInternals).rl;
    rl.history = ["test one", "test two", "test three"];

    // Rapid sequence: Ctrl+R, type, Ctrl+R again, escape
    simulateKeypress(null, { ctrl: true, name: "r" });
    simulateKeypress("t", { name: "t" });
    simulateKeypress("e", { name: "e" });
    simulateKeypress("s", { name: "s" });
    simulateKeypress("t", { name: "t" });
    simulateKeypress(null, { ctrl: true, name: "r" });
    simulateKeypress(null, { ctrl: true, name: "r" });
    simulateKeypress(null, { name: "escape" });

    // Should handle all keys without errors
    const historySearch = (cmd as unknown as InteractiveInternals)
      .historySearch;
    expect(historySearch.active).toBe(false);
  });

  it("should preserve prompt state after errors", async () => {
    const cmd = new Interactive([], {} as unknown as Config);
    cmd.config = {
      version: "1.0.0",
      commands: [],
      runCommand: vi.fn().mockRejectedValue(new Error("Command failed")),
      findCommand: vi.fn(),
      root: "/test",
    } as unknown as Config;

    await cmd.run();

    const rl = (cmd as unknown as InteractiveInternals).rl;
    const promptStub = vi.spyOn(rl, "prompt");

    // Simulate command execution
    rl.emit("line", "invalid command");

    // Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Prompt should be called again after error
    expect(promptStub).toHaveBeenCalled();
  });

  it("should handle special characters in autocomplete", async () => {
    const cmd = new Interactive([], {} as unknown as Config);
    cmd.config = {
      version: "1.0.0",
      commands: [
        {
          id: "test-command",
          description: "Test command with dash",
          flags: {},
          args: {},
          run: vi.fn(),
        },
      ],
      runCommand: vi.fn(),
      findCommand: vi.fn(),
      root: "/test",
    } as unknown as Config;

    await cmd.run();

    const completer = (cmd as unknown as InteractiveInternals).completer.bind(
      cmd,
    );

    // Test autocomplete with special characters
    const result = completer("test-");
    expect(result[0]).toContain("test-command");
  });

  it("should handle concurrent operations correctly", async () => {
    const cmd = new Interactive([], {} as unknown as Config);
    cmd.config = {
      version: "1.0.0",
      commands: [],
      runCommand: vi.fn(),
      findCommand: vi.fn(),
      root: "/test",
    } as unknown as Config;

    await cmd.run();

    const rl = (cmd as unknown as InteractiveInternals).rl;
    rl.history = ["command one", "command two"];

    // Start history search
    simulateKeypress(null, { ctrl: true, name: "r" });

    // Type while also trying to navigate history (should be ignored)
    simulateKeypress("c", { name: "c" });
    rl.emit("history", -1); // This should be ignored during search
    simulateKeypress("o", { name: "o" });

    const historySearch = (cmd as unknown as InteractiveInternals)
      .historySearch;
    expect(historySearch.searchTerm).toBe("co");
    expect(historySearch.active).toBe(true);
  });

  it("should handle edge cases in history cycling", async () => {
    const cmd = new Interactive([], {} as unknown as Config);
    cmd.config = {
      version: "1.0.0",
      commands: [],
      runCommand: vi.fn(),
      findCommand: vi.fn(),
      root: "/test",
    } as unknown as Config;

    await cmd.run();

    const rl = (cmd as unknown as InteractiveInternals).rl;
    rl.history = ["match1", "no", "match2"];

    // Enter history search
    simulateKeypress(null, { ctrl: true, name: "r" });
    simulateKeypress("m", { name: "m" });
    simulateKeypress("a", { name: "a" });
    simulateKeypress("t", { name: "t" });
    simulateKeypress("c", { name: "c" });
    simulateKeypress("h", { name: "h" });

    const historySearch = (cmd as unknown as InteractiveInternals)
      .historySearch;

    // Should find 2 matches
    expect(historySearch.matches.length).toBe(2);

    // Cycle through all matches and wrap around
    simulateKeypress(null, { ctrl: true, name: "r" }); // to match2
    simulateKeypress(null, { ctrl: true, name: "r" }); // back to match1
    simulateKeypress(null, { ctrl: true, name: "r" }); // to match2 again

    expect(historySearch.currentIndex).toBe(1);
  });

  it("should clean up resources on exit", async () => {
    const cmd = new Interactive([], {} as unknown as Config);
    cmd.config = {
      version: "1.0.0",
      commands: [],
      runCommand: vi.fn(),
      findCommand: vi.fn(),
      root: "/test",
    } as unknown as Config;

    await cmd.run();

    const rl = (cmd as unknown as InteractiveInternals).rl;
    const closeStub = vi.spyOn(rl, "close");

    // Simulate exit command
    rl.emit("line", "exit");

    // Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Readline should be closed
    expect(closeStub).toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(exitStub).toHaveBeenCalled();
    });
  });
});
