import { describe, it, expect } from "vitest";
import { parseNdjsonLines, parseLogLines } from "../../helpers/ndjson.js";

describe("parseNdjsonLines", () => {
  it("parses multiple JSON lines from stdout", () => {
    const stdout = '{"type":"event","a":1}\n{"type":"event","a":2}\n';
    const records = parseNdjsonLines(stdout);
    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({ type: "event", a: 1 });
    expect(records[1]).toEqual({ type: "event", a: 2 });
  });

  it("handles single-line output", () => {
    const stdout = '{"type":"result","success":true}\n';
    const records = parseNdjsonLines(stdout);
    expect(records).toHaveLength(1);
    expect(records[0].type).toBe("result");
  });

  it("skips empty lines", () => {
    const stdout = '{"a":1}\n\n{"a":2}\n\n';
    const records = parseNdjsonLines(stdout);
    expect(records).toHaveLength(2);
  });

  it("returns empty array for empty string", () => {
    expect(parseNdjsonLines("")).toEqual([]);
    expect(parseNdjsonLines("  \n  ")).toEqual([]);
  });

  it("skips non-JSON lines silently", () => {
    const stdout =
      '(node:1234) ExperimentalWarning: something\n{"type":"event","a":1}\nsome other text\n{"type":"result","b":2}\n';
    const records = parseNdjsonLines(stdout);
    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({ type: "event", a: 1 });
    expect(records[1]).toEqual({ type: "result", b: 2 });
  });
});

describe("parseLogLines", () => {
  it("parses JSON lines from a string array", () => {
    const lines = ['{"type":"event","x":1}', '{"type":"log","y":2}'];
    const records = parseLogLines(lines);
    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({ type: "event", x: 1 });
  });

  it("skips non-JSON lines silently", () => {
    const lines = [
      "Attaching to channel...",
      '{"type":"event","data":"hello"}',
      "✓ Subscribed.",
      '{"type":"event","data":"world"}',
    ];
    const records = parseLogLines(lines);
    expect(records).toHaveLength(2);
    expect(records[0].data).toBe("hello");
    expect(records[1].data).toBe("world");
  });

  it("returns empty array for all non-JSON lines", () => {
    const lines = ["not json", "also not json"];
    expect(parseLogLines(lines)).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(parseLogLines([])).toEqual([]);
  });
});
