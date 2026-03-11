import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StatsDisplay } from "../../../src/services/stats-display.js";

describe("StatsDisplay", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.useRealTimers();
  });

  it("outputs JSON record with envelope in JSON mode", () => {
    const display = new StatsDisplay({ json: true, command: "stats" });
    const stats = {
      entries: { "messages.all.all.count": 10 },
      intervalId: "2025-01-15:10:30",
    };
    display.display(stats);
    const output = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("type", "result");
    expect(parsed).toHaveProperty("command", "stats");
    expect(parsed).toHaveProperty("success", true);
    expect(parsed.entries).toEqual({ "messages.all.all.count": 10 });
    expect(parsed.intervalId).toBe("2025-01-15:10:30");
  });

  it("produces no output for null stats", () => {
    const display = new StatsDisplay();
    display.display(null as unknown as Parameters<typeof display.display>[0]);
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it("skips duplicate stats in historical mode", () => {
    const display = new StatsDisplay();
    const stats = {
      entries: { "messages.all.all.count": 5 },
      intervalId: "2025-01-15:10:30",
      unit: "minute",
    };
    display.display(stats);
    const callCountAfterFirst = consoleSpy.mock.calls.length;
    display.display(stats);
    expect(consoleSpy.mock.calls.length).toBe(callCountAfterFirst);
  });

  it("shows 'Stats for' header in historical mode", () => {
    const display = new StatsDisplay();
    const stats = {
      entries: {},
      intervalId: "2025-01-15:10:30",
      unit: "minute",
    };
    display.display(stats);
    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Stats for");
  });

  it("shows 'Stats Dashboard' header in live mode", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T10:30:00Z"));
    const display = new StatsDisplay({ live: true });
    const stats = { entries: {}, intervalId: "2025-01-15:10:30" };
    display.display(stats);
    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Stats Dashboard");
    vi.useRealTimers();
  });

  describe("formatBytes (private)", () => {
    it.each([
      [0, "0.0 B"],
      [500, "500.0 B"],
      [1536, "1.5 KB"],
      [1048576, "1.0 MB"],
    ])("formats %d as %s", (input, expected) => {
      const display = new StatsDisplay();
      const result = (display as Record<string, (n: number) => string>)[
        "formatBytes"
      ](input);
      expect(result).toBe(expected);
    });
  });

  describe("formatElapsedTime (private)", () => {
    it.each([
      [45_000, "45s"],
      [125_000, "2m 5s"],
      [3_661_000, "1h 1m 1s"],
    ])("formats %d ms elapsed as '%s'", (elapsedMs, expected) => {
      vi.useFakeTimers();
      const startTime = new Date(1000);
      vi.setSystemTime(new Date(1000 + elapsedMs));
      const display = new StatsDisplay({ live: true, startTime });
      const result = (display as Record<string, () => string>)[
        "formatElapsedTime"
      ]();
      expect(result).toBe(expected);
      vi.useRealTimers();
    });
  });

  describe("parseIntervalId (private)", () => {
    it("parses minute format correctly", () => {
      const display = new StatsDisplay();
      const result = (
        display as Record<
          string,
          (id: string, unit: string) => { period: string; start: Date }
        >
      )["parseIntervalId"]("2025-01-15:10:30", "minute");
      expect(result.start.getTime()).toBe(Date.UTC(2025, 0, 15, 10, 30));
    });

    it("parses hour format correctly", () => {
      const display = new StatsDisplay();
      const result = (
        display as Record<
          string,
          (id: string, unit: string) => { period: string; start: Date }
        >
      )["parseIntervalId"]("2025-01-15:10", "hour");
      expect(result.start.getTime()).toBe(Date.UTC(2025, 0, 15, 10));
    });

    it("handles malformed intervalId with fallback", () => {
      const display = new StatsDisplay();
      (
        display as Record<
          string,
          (id: string, unit: string) => { period: string; start: Date }
        >
      )["parseIntervalId"]("bad-format", "minute");
      const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("Note: Could not parse");
    });
  });
});
