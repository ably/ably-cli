import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseTimestamp } from "../../../src/utils/time.js";

describe("parseTimestamp", () => {
  describe("Unix milliseconds", () => {
    it("should parse a numeric string as ms since epoch", () => {
      expect(parseTimestamp("1700000000000")).toBe(1700000000000);
    });

    it("should parse zero", () => {
      expect(parseTimestamp("0")).toBe(0);
    });
  });

  describe("ISO 8601", () => {
    it("should parse a UTC ISO 8601 string", () => {
      expect(parseTimestamp("2023-01-01T00:00:00Z")).toBe(
        new Date("2023-01-01T00:00:00Z").getTime(),
      );
    });

    it("should parse a date-only string", () => {
      const result = parseTimestamp("2023-06-15");
      expect(result).toBe(new Date("2023-06-15").getTime());
    });
  });

  describe("relative time", () => {
    const NOW = 1700000000000;

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should parse seconds (30s)", () => {
      expect(parseTimestamp("30s")).toBe(NOW - 30 * 1000);
    });

    it("should parse minutes (5m)", () => {
      expect(parseTimestamp("5m")).toBe(NOW - 5 * 60_000);
    });

    it("should parse hours (1h)", () => {
      expect(parseTimestamp("1h")).toBe(NOW - 3_600_000);
    });

    it("should parse days (2d)", () => {
      expect(parseTimestamp("2d")).toBe(NOW - 2 * 86_400_000);
    });

    it("should parse weeks (1w)", () => {
      expect(parseTimestamp("1w")).toBe(NOW - 604_800_000);
    });
  });

  describe("relative time used as --end", () => {
    const NOW = 1700000000000;

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should parse relative time with end label (30m)", () => {
      expect(parseTimestamp("30m", "end")).toBe(NOW - 30 * 60_000);
    });
  });

  describe("error cases", () => {
    it("should throw on invalid input", () => {
      expect(() => parseTimestamp("not-a-date")).toThrow(
        'Invalid timestamp: "not-a-date"',
      );
    });

    it("should throw on empty string", () => {
      expect(() => parseTimestamp("")).toThrow('Invalid timestamp: ""');
    });

    it("should include the label in error messages", () => {
      expect(() => parseTimestamp("garbage", "start")).toThrow(
        'Invalid start: "garbage"',
      );
    });

    it("should include format hints in error message", () => {
      expect(() => parseTimestamp("xyz")).toThrow("ISO 8601");
      expect(() => parseTimestamp("xyz")).toThrow("Unix ms");
      expect(() => parseTimestamp("xyz")).toThrow("relative");
    });
  });
});
