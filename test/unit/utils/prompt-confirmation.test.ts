import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let mockQuestion: (query: string, callback: (answer: string) => void) => void;
let mockOnHandlers: Record<string, (() => void)[]>;

vi.mock("node:readline", () => ({
  createInterface: () => ({
    closed: false,
    close: vi.fn(),
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

import { promptForConfirmation } from "../../../src/utils/prompt-confirmation.js";

describe("promptForConfirmation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockOnHandlers = {};
  });

  it.each(["y", "yes", "Y", "YES", " yes "])(
    "returns true for affirmative input: '%s'",
    async (input) => {
      mockQuestion = (_query, callback) => callback(input);
      const result = await promptForConfirmation("Delete this?");
      expect(result).toBe(true);
    },
  );

  it.each(["n", "no", "", "maybe", "yep"])(
    "returns false for non-affirmative input: '%s'",
    async (input) => {
      mockQuestion = (_query, callback) => callback(input);
      const result = await promptForConfirmation("Delete this?");
      expect(result).toBe(false);
    },
  );

  it("appends [y/n] suffix when message does not include it", async () => {
    let capturedQuery = "";
    mockQuestion = (query, callback) => {
      capturedQuery = query;
      callback("no");
    };
    await promptForConfirmation("Are you sure?");
    expect(capturedQuery).toBe("Are you sure? [y/n]");
  });

  describe("defaultValue parameter", () => {
    it("returns true for empty input when defaultValue is true", async () => {
      mockQuestion = (_query, callback) => callback("");
      const result = await promptForConfirmation("Did you mean X?", true);
      expect(result).toBe(true);
    });

    it("returns false for empty input when defaultValue is false", async () => {
      mockQuestion = (_query, callback) => callback("");
      const result = await promptForConfirmation("Delete this?", false);
      expect(result).toBe(false);
    });

    it("explicit 'n' overrides defaultValue true", async () => {
      mockQuestion = (_query, callback) => callback("n");
      const result = await promptForConfirmation("Did you mean X?", true);
      expect(result).toBe(false);
    });

    it("explicit 'y' overrides defaultValue false", async () => {
      mockQuestion = (_query, callback) => callback("y");
      const result = await promptForConfirmation("Delete this?", false);
      expect(result).toBe(true);
    });

    it("appends [Y/n] suffix when defaultValue is true", async () => {
      let capturedQuery = "";
      mockQuestion = (query, callback) => {
        capturedQuery = query;
        callback("y");
      };
      await promptForConfirmation("Did you mean X?", true);
      expect(capturedQuery).toBe("Did you mean X? [Y/n]");
    });

    it("appends [y/n] suffix when defaultValue is false", async () => {
      let capturedQuery = "";
      mockQuestion = (query, callback) => {
        capturedQuery = query;
        callback("n");
      };
      await promptForConfirmation("Delete this?", false);
      expect(capturedQuery).toBe("Delete this? [y/n]");
    });

    it("does not double-append suffix when message already contains [Y/n]", async () => {
      let capturedQuery = "";
      mockQuestion = (query, callback) => {
        capturedQuery = query;
        callback("y");
      };
      await promptForConfirmation("Continue? [Y/n]", true);
      expect(capturedQuery).toBe("Continue? [Y/n]");
    });
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
      mockQuestion = (_query, callback) => callback("y");

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

      const result = await promptForConfirmation("Continue?", true);
      expect(result).toBe(true);

      // Pause + listener removal happen before the prompt runs
      expect(replReadline.pause).toHaveBeenCalled();
      expect(replReadline.removeAllListeners).toHaveBeenCalledWith("line");

      // Resume is scheduled via setTimeout(20ms); wait for it to fire
      await vi.waitFor(() => {
        expect(replReadline.resume).toHaveBeenCalled();
      });

      // Line listeners reattached
      expect(replReadline.on.mock.calls.length).toBe(lineListeners.length);
      lineListeners.forEach((listener, index) => {
        expect(replReadline.on.mock.calls[index]).toEqual(["line", listener]);
      });

      // Terminal raw mode restored to its prior value
      expect(process.stdin.setRawMode).toHaveBeenCalledWith(false);
    });

    it("runs without REPL interaction when no interactive readline is registered", async () => {
      mockQuestion = (_query, callback) => callback("n");
      // No __ablyInteractiveReadline set → no pause/resume should happen
      const result = await promptForConfirmation("Continue?");
      expect(result).toBe(false);
    });
  });

  describe("SIGINT and close handling", () => {
    it("returns false on SIGINT even when defaultValue is true", async () => {
      mockQuestion = () => {
        for (const handler of mockOnHandlers["SIGINT"] ?? []) {
          handler();
        }
      };
      const result = await promptForConfirmation("Did you mean X?", true);
      expect(result).toBe(false);
    });

    it("returns false on close even when defaultValue is true", async () => {
      mockQuestion = () => {
        for (const handler of mockOnHandlers["close"] ?? []) {
          handler();
        }
      };
      const result = await promptForConfirmation("Did you mean X?", true);
      expect(result).toBe(false);
    });

    it("returns false on SIGINT with default defaultValue", async () => {
      mockQuestion = () => {
        for (const handler of mockOnHandlers["SIGINT"] ?? []) {
          handler();
        }
      };
      const result = await promptForConfirmation("Delete this?");
      expect(result).toBe(false);
    });

    it("returns false on close with default defaultValue", async () => {
      mockQuestion = () => {
        for (const handler of mockOnHandlers["close"] ?? []) {
          handler();
        }
      };
      const result = await promptForConfirmation("Delete this?");
      expect(result).toBe(false);
    });
  });
});
