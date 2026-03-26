import { describe, it, expect } from "vitest";
import { errorMessage } from "../../../src/utils/errors.js";

describe("errorMessage", () => {
  it("should extract message from Error instances", () => {
    expect(errorMessage(new Error("test error"))).toBe("test error");
  });

  it("should stringify non-Error values", () => {
    expect(errorMessage("string error")).toBe("string error");
    expect(errorMessage(42)).toBe("42");
  });
});
