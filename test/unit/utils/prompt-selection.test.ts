import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let mockQuestion: (query: string, callback: (answer: string) => void) => void;
let mockWrite: ReturnType<typeof vi.fn>;
let mockOnHandlers: Record<string, (() => void)[]>;
let mockClose: ReturnType<typeof vi.fn>;

vi.mock("node:readline", () => ({
  createInterface: () => ({
    closed: false,
    close: () => mockClose(),
    write: (text: string) => mockWrite(text),
    question: (query: string, callback: (answer: string) => void) => {
      mockQuestion(query, callback);
    },
    on: (event: string, handler: () => void) => {
      if (!mockOnHandlers[event]) {
        mockOnHandlers[event] = [];
      }
      mockOnHandlers[event].push(handler);
    },
  }),
}));

import { promptForSelection } from "../../../src/utils/prompt-selection.js";

const choices = [
  { name: "App One (app1)", value: { id: "app1", name: "App One" } },
  { name: "App Two (app2)", value: { id: "app2", name: "App Two" } },
  { name: "App Three (app3)", value: { id: "app3", name: "App Three" } },
];

describe("promptForSelection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockWrite = vi.fn();
    mockClose = vi.fn();
    mockOnHandlers = {};
  });

  it("returns the selected item for valid input", async () => {
    mockQuestion = (_query, callback) => callback("2");
    const result = await promptForSelection("Select an app:", choices);
    expect(result).toEqual({ id: "app2", name: "App Two" });
  });

  it("returns first item for input '1'", async () => {
    mockQuestion = (_query, callback) => callback("1");
    const result = await promptForSelection("Select an app:", choices);
    expect(result).toEqual({ id: "app1", name: "App One" });
  });

  it("returns last item for input matching choices length", async () => {
    mockQuestion = (_query, callback) => callback("3");
    const result = await promptForSelection("Select an app:", choices);
    expect(result).toEqual({ id: "app3", name: "App Three" });
  });

  it("returns null for empty input", async () => {
    mockQuestion = (_query, callback) => callback("");
    const result = await promptForSelection("Select an app:", choices);
    expect(result).toBeNull();
  });

  it("returns null for empty choices array", async () => {
    const result = await promptForSelection("Select:", []);
    expect(result).toBeNull();
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it("re-prompts on non-numeric input then accepts valid input", async () => {
    let callCount = 0;
    mockQuestion = (_query, callback) => {
      callCount++;
      if (callCount === 1) {
        callback("abc");
      } else {
        callback("1");
      }
    };
    const result = await promptForSelection("Select an app:", choices);
    expect(result).toEqual({ id: "app1", name: "App One" });
    expect(callCount).toBe(2);
  });

  it("re-prompts on partially numeric input like '2abc'", async () => {
    let callCount = 0;
    mockQuestion = (_query, callback) => {
      callCount++;
      if (callCount === 1) {
        callback("2abc");
      } else {
        callback("2");
      }
    };
    const result = await promptForSelection("Select an app:", choices);
    expect(result).toEqual({ id: "app2", name: "App Two" });
    expect(callCount).toBe(2);
  });

  it("re-prompts on decimal input like '2.5'", async () => {
    let callCount = 0;
    mockQuestion = (_query, callback) => {
      callCount++;
      if (callCount === 1) {
        callback("2.5");
      } else {
        callback("2");
      }
    };
    const result = await promptForSelection("Select an app:", choices);
    expect(result).toEqual({ id: "app2", name: "App Two" });
    expect(callCount).toBe(2);
  });

  it("re-prompts on out-of-range input then accepts valid input", async () => {
    let callCount = 0;
    mockQuestion = (_query, callback) => {
      callCount++;
      if (callCount === 1) {
        callback("5");
      } else {
        callback("2");
      }
    };
    const result = await promptForSelection("Select an app:", choices);
    expect(result).toEqual({ id: "app2", name: "App Two" });
    expect(callCount).toBe(2);
  });

  it("re-prompts on zero input", async () => {
    let callCount = 0;
    mockQuestion = (_query, callback) => {
      callCount++;
      if (callCount === 1) {
        callback("0");
      } else {
        callback("1");
      }
    };
    const result = await promptForSelection("Select an app:", choices);
    expect(result).toEqual({ id: "app1", name: "App One" });
    expect(callCount).toBe(2);
  });

  it("displays numbered list with message", async () => {
    mockQuestion = (_query, callback) => callback("1");
    await promptForSelection("Select an app:", choices);

    expect(mockWrite).toHaveBeenCalledWith("Select an app:\n");
    expect(mockWrite).toHaveBeenCalledWith("  [1] App One (app1)\n");
    expect(mockWrite).toHaveBeenCalledWith("  [2] App Two (app2)\n");
    expect(mockWrite).toHaveBeenCalledWith("  [3] App Three (app3)\n");
  });

  it("handles single choice", async () => {
    mockQuestion = (_query, callback) => callback("1");
    const singleChoice = [{ name: "Only Option", value: "only" }];
    const result = await promptForSelection("Pick one:", singleChoice);
    expect(result).toBe("only");
  });

  it("trims whitespace from input", async () => {
    mockQuestion = (_query, callback) => callback("  2  ");
    const result = await promptForSelection("Select:", choices);
    expect(result).toEqual({ id: "app2", name: "App Two" });
  });

  it("returns null on SIGINT", async () => {
    mockQuestion = () => {
      // Simulate SIGINT before answering
      for (const handler of mockOnHandlers["SIGINT"] ?? []) {
        handler();
      }
    };
    const result = await promptForSelection("Select:", choices);
    expect(result).toBeNull();
  });

  it("returns null on close", async () => {
    mockQuestion = () => {
      // Simulate close before answering
      for (const handler of mockOnHandlers["close"] ?? []) {
        handler();
      }
    };
    const result = await promptForSelection("Select:", choices);
    expect(result).toBeNull();
  });

  describe("interactive REPL state restoration", () => {
    const originalIsRaw = process.stdin.isRaw;
    const originalIsTTY = process.stdin.isTTY;
    const originalSetRawMode = process.stdin.setRawMode;

    afterEach(() => {
      delete (globalThis as Record<string, unknown>).__ablyInteractiveReadline;
      process.stdin.isRaw = originalIsRaw;
      process.stdin.isTTY = originalIsTTY;
      process.stdin.setRawMode = originalSetRawMode;
    });

    it("pauses, restores listeners, and resumes the REPL readline when active", async () => {
      mockQuestion = (_query, callback) => callback("1");

      const lineListeners = [vi.fn(), vi.fn()];
      const replReadline = {
        pause: vi.fn(),
        resume: vi.fn(),
        listeners: vi.fn().mockReturnValue(lineListeners),
        removeAllListeners: vi.fn(),
        on: vi.fn(),
        _refreshLine: vi.fn(),
      };
      (globalThis as Record<string, unknown>).__ablyInteractiveReadline =
        replReadline;

      process.stdin.isRaw = false;
      process.stdin.isTTY = true;
      process.stdin.setRawMode = vi.fn().mockReturnValue(process.stdin);

      const result = await promptForSelection("Pick:", choices);
      expect(result).toEqual({ id: "app1", name: "App One" });

      expect(replReadline.pause).toHaveBeenCalled();
      expect(replReadline.removeAllListeners).toHaveBeenCalledWith("line");

      // Resume scheduled via setTimeout(20ms)
      await vi.waitFor(() => {
        expect(replReadline.resume).toHaveBeenCalled();
      });

      expect(replReadline.on.mock.calls.length).toBe(lineListeners.length);
      lineListeners.forEach((listener, index) => {
        expect(replReadline.on.mock.calls[index]).toEqual(["line", listener]);
      });

      expect(process.stdin.setRawMode).toHaveBeenCalledWith(false);
    });

    it("runs without REPL interaction when no interactive readline is registered", async () => {
      mockQuestion = (_query, callback) => callback("2");
      // No __ablyInteractiveReadline set
      const result = await promptForSelection("Pick:", choices);
      expect(result).toEqual({ id: "app2", name: "App Two" });
    });
  });

  describe("separators", () => {
    it("renders separator entries un-numbered with single-space prefix", async () => {
      mockQuestion = (_query, callback) => callback("1");
      await promptForSelection("Select an account:", [
        { separator: "── Local accounts ──" },
        { name: "prod", value: "prod" },
        { name: "staging", value: "staging" },
        { separator: "── Other accounts ──" },
        { name: "external", value: "external" },
      ]);

      // Separators: single leading space, no [N] marker (matches inquirer's render)
      expect(mockWrite).toHaveBeenCalledWith(" ── Local accounts ──\n");
      expect(mockWrite).toHaveBeenCalledWith(" ── Other accounts ──\n");
      // Selectable items numbered sequentially, ignoring separators
      expect(mockWrite).toHaveBeenCalledWith("  [1] prod\n");
      expect(mockWrite).toHaveBeenCalledWith("  [2] staging\n");
      expect(mockWrite).toHaveBeenCalledWith("  [3] external\n");
    });

    it("numbers only selectable items so '1' picks the first selectable", async () => {
      mockQuestion = (_query, callback) => callback("1");
      const result = await promptForSelection<string>("Pick:", [
        { separator: "── Section ──" },
        { name: "first", value: "first" },
        { name: "second", value: "second" },
      ]);
      expect(result).toBe("first");
    });

    it("rejects out-of-range numbers based on selectable count, not total entries", async () => {
      // 2 selectables + 2 separators = 4 entries. "3" must be rejected.
      let callCount = 0;
      mockQuestion = (_query, callback) => {
        callCount++;
        if (callCount === 1) {
          callback("3");
        } else {
          callback("2");
        }
      };
      const result = await promptForSelection<string>("Pick:", [
        { separator: "── A ──" },
        { name: "first", value: "first" },
        { separator: "── B ──" },
        { name: "second", value: "second" },
      ]);
      expect(result).toBe("second");
      expect(callCount).toBe(2);
      expect(mockWrite).toHaveBeenCalledWith(
        "Invalid selection. Enter a number between 1 and 2.\n",
      );
    });

    it("returns null when choices contain only separators (no selectables)", async () => {
      const result = await promptForSelection("Pick:", [
        { separator: "── A ──" },
        { separator: "── B ──" },
      ]);
      expect(result).toBeNull();
      expect(mockWrite).not.toHaveBeenCalled();
    });

    it("supports separators interleaved at any position", async () => {
      mockQuestion = (_query, callback) => callback("2");
      const result = await promptForSelection<string>("Pick:", [
        { name: "alpha", value: "alpha" },
        { separator: "── divider ──" },
        { name: "beta", value: "beta" },
      ]);
      expect(result).toBe("beta");
    });
  });
});
