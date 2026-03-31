import { describe, it, expect, vi, beforeEach } from "vitest";

let mockQuestion: (query: string, callback: (answer: string) => void) => void;

vi.mock("node:readline", () => ({
  createInterface: () => ({
    close: vi.fn(),
    question: (query: string, callback: (answer: string) => void) => {
      mockQuestion(query, callback);
    },
  }),
}));

import { promptForConfirmation } from "../../../src/utils/prompt-confirmation.js";

describe("promptForConfirmation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
});
