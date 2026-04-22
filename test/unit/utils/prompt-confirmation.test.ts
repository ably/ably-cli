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
});
