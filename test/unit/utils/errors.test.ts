import { describe, it, expect } from "vitest";
import {
  errorMessage,
  getAblyErrorCode,
  enhanceErrorMessage,
} from "../../../src/utils/errors.js";

describe("errorMessage", () => {
  it("should extract message from Error object", () => {
    const error = new Error("Test error message");
    expect(errorMessage(error)).toBe("Test error message");
  });

  it("should convert non-Error to string", () => {
    expect(errorMessage("string error")).toBe("string error");
    expect(errorMessage(123)).toBe("123");
    expect(errorMessage(null)).toBe("null");
  });

  it("should handle undefined", () => {
    let undefinedValue: unknown;
    expect(errorMessage(undefinedValue)).toBe("undefined");
  });
});

describe("getAblyErrorCode", () => {
  it("should extract code from Ably-style error object", () => {
    const error = { code: 93002, message: "Test error" };
    expect(getAblyErrorCode(error)).toBe(93002);
  });

  it("should return undefined for Error without code", () => {
    const error = new Error("Test error");
    expect(getAblyErrorCode(error)).toBeUndefined();
  });

  it("should return undefined for non-object", () => {
    expect(getAblyErrorCode("string")).toBeUndefined();
    expect(getAblyErrorCode(123)).toBeUndefined();
    expect(getAblyErrorCode(null)).toBeUndefined();
    let undefinedValue: unknown;
    expect(getAblyErrorCode(undefinedValue)).toBeUndefined();
  });

  it("should return undefined for object with non-numeric code", () => {
    const error = { code: "not-a-number", message: "Test error" };
    expect(getAblyErrorCode(error)).toBeUndefined();
  });
});

describe("enhanceErrorMessage", () => {
  describe("error code 93002 (mutable messages not enabled)", () => {
    it("should enhance error message with channel rule hint", () => {
      const error = { code: 93002, message: "Mutable messages not enabled" };
      const baseMessage = "Mutable messages not enabled";
      const enhanced = enhanceErrorMessage(error, baseMessage);

      expect(enhanced).toContain(baseMessage);
      expect(enhanced).toContain("Hint:");
      expect(enhanced).toContain(
        "Message annotations, updates, deletes, and appends",
      );
      expect(enhanced).toContain("Channel rules");
      expect(enhanced).toContain(
        "https://ably.com/docs/messages/annotations#enable",
      );
    });

    it("should include step-by-step instructions", () => {
      const error = { code: 93002, message: "Test" };
      const enhanced = enhanceErrorMessage(error, "Test");

      expect(enhanced).toContain("Settings tab");
      expect(enhanced).toContain("Add new rule");
      expect(enhanced).toContain("Create channel rule");
    });
  });

  describe("unknown error codes", () => {
    it("should return original message for unknown error codes", () => {
      const error = { code: 99999, message: "Unknown error" };
      const baseMessage = "Unknown error";
      const enhanced = enhanceErrorMessage(error, baseMessage);

      expect(enhanced).toBe(baseMessage);
    });

    it("should return original message for errors without code", () => {
      const error = new Error("Regular error");
      const baseMessage = "Regular error";
      const enhanced = enhanceErrorMessage(error, baseMessage);

      expect(enhanced).toBe(baseMessage);
    });

    it("should return original message for non-object errors", () => {
      const enhanced = enhanceErrorMessage("string error", "string error");
      expect(enhanced).toBe("string error");
    });
  });
});
