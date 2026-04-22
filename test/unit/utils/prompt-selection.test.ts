import { describe, it, expect, vi, beforeEach } from "vitest";

let mockQuestion: (query: string, callback: (answer: string) => void) => void;
let mockWrite: ReturnType<typeof vi.fn>;

vi.mock("node:readline", () => ({
  createInterface: () => ({
    close: vi.fn(),
    write: (text: string) => mockWrite(text),
    question: (query: string, callback: (answer: string) => void) => {
      mockQuestion(query, callback);
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
});
