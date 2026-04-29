import { describe, it, expect } from "vitest";
import {
  resolveCurrentKeyName,
  parseCapabilities,
} from "../../../src/utils/key-parsing.js";

describe("resolveCurrentKeyName", () => {
  it("should prefix keyId with appId", () => {
    expect(resolveCurrentKeyName("app123", "key456")).toBe("app123.key456");
  });

  it("should return as-is when keyId already includes appId", () => {
    expect(resolveCurrentKeyName("app123", "app123.key456")).toBe(
      "app123.key456",
    );
  });

  it("should return undefined when keyId is not provided", () => {
    expect(resolveCurrentKeyName("app123")).toBeUndefined();
  });

  it("should return undefined when keyId is empty string", () => {
    expect(resolveCurrentKeyName("app123", "")).toBeUndefined();
  });
});

describe("parseCapabilities", () => {
  describe("JSON input", () => {
    it("should parse a valid JSON capabilities object", () => {
      const result = parseCapabilities(
        '{"channel1":["publish"],"channel2":["subscribe"]}',
      );
      expect(result).toEqual({
        channel1: ["publish"],
        channel2: ["subscribe"],
      });
    });

    it("should parse JSON with leading whitespace", () => {
      const result = parseCapabilities('  {"*":["*"]}');
      expect(result).toEqual({ "*": ["*"] });
    });

    it("should throw on invalid JSON", () => {
      expect(() => parseCapabilities("{invalid-json")).toThrow(
        "Invalid capabilities JSON format. Please provide a valid JSON string.",
      );
    });

    it("should preserve the original parse error as cause", () => {
      let thrown: Error | undefined;
      try {
        parseCapabilities("{invalid-json");
      } catch (error) {
        thrown = error as Error;
      }
      expect(thrown).toBeDefined();
      expect(thrown!.cause).toBeInstanceOf(SyntaxError);
    });
  });

  describe("comma-separated input", () => {
    it("should parse a single capability", () => {
      expect(parseCapabilities("publish")).toEqual({ "*": ["publish"] });
    });

    it("should parse multiple comma-separated capabilities", () => {
      expect(parseCapabilities("publish,subscribe,history")).toEqual({
        "*": ["publish", "subscribe", "history"],
      });
    });

    it("should trim whitespace around capabilities", () => {
      expect(parseCapabilities(" publish , subscribe ")).toEqual({
        "*": ["publish", "subscribe"],
      });
    });

    it("should filter out empty entries from extra commas", () => {
      expect(parseCapabilities("publish,,subscribe")).toEqual({
        "*": ["publish", "subscribe"],
      });
    });

    it("should throw on empty capabilities", () => {
      expect(() => parseCapabilities(",,")).toThrow(
        "Capabilities must contain at least one non-empty capability.",
      );
    });

    it("should throw on whitespace-only input", () => {
      expect(() => parseCapabilities("  ")).toThrow(
        "Capabilities must contain at least one non-empty capability.",
      );
    });
  });
});
