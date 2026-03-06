import { describe, it, expect, beforeAll } from "vitest";
import chalk from "chalk";
import { formatJson, isJsonData } from "../../../src/utils/json-formatter.js";

beforeAll(() => {
  chalk.level = 1;
});

describe("isJsonData", () => {
  it("returns false for primitives", () => {
    expect(isJsonData(null)).toBe(false);
    expect(isJsonData()).toBe(false);
    expect(isJsonData(42)).toBe(false);
    expect(isJsonData(true)).toBe(false);
  });

  it("returns true for objects and arrays", () => {
    expect(isJsonData({ a: 1 })).toBe(true);
    expect(isJsonData([1, 2])).toBe(true);
    expect(isJsonData({})).toBe(true);
    expect(isJsonData([])).toBe(true);
  });

  it("returns true for valid JSON strings representing objects/arrays", () => {
    expect(isJsonData('{"a":1}')).toBe(true);
    expect(isJsonData("[1,2,3]")).toBe(true);
  });

  it("returns false for non-JSON strings", () => {
    expect(isJsonData("hello")).toBe(false);
    expect(isJsonData("{bad}")).toBe(false);
    expect(isJsonData('"42"')).toBe(false);
  });
});

describe("formatJson", () => {
  it("returns gray 'undefined' for undefined", () => {
    const result = formatJson();
    expect(result).toContain("undefined");
  });

  it("returns gray 'null' for null", () => {
    const result = formatJson(null);
    expect(result).toContain("null");
  });

  it("colorizes numbers as yellow", () => {
    const result = formatJson(42);
    expect(result).toBe(chalk.yellow(42));
  });

  it("colorizes booleans as cyan", () => {
    const result = formatJson(true);
    expect(result).toBe(chalk.cyan(true));
  });

  it("colorizes strings as green with quotes", () => {
    const result = formatJson("hello");
    expect(result).toBe(chalk.green('"hello"'));
  });

  it("formats objects with blue keys", () => {
    const result = formatJson({ count: 5 });
    expect(result).toContain(chalk.blue('"count"'));
    expect(result).toContain("5");
  });

  it("handles circular references without throwing", () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    expect(() => formatJson(obj)).not.toThrow();
  });
});
