import { describe, it, expect } from "vitest";
import { closest } from "../../../src/utils/string-distance.js";

describe("closest (string-distance)", () => {
  const possibilities = [
    "channels:list",
    "channels:publish",
    "apps:list",
    "apps:create",
    "accounts:login",
  ];

  it("returns exact match (distance 0)", () => {
    expect(closest("channels:list", possibilities)).toBe("channels:list");
  });

  it("returns closest match for a 1-char typo", () => {
    expect(closest("channls:list", possibilities)).toBe("channels:list");
  });

  it("normalizes spaces to colons for matching", () => {
    expect(closest("channels list", possibilities)).toBe("channels:list");
  });

  it("returns empty string when no match is within threshold", () => {
    expect(closest("zzzzzzzzzzz", possibilities)).toBe("");
  });

  it("returns empty string for empty possibilities array", () => {
    expect(closest("channels:list", [])).toBe("");
  });
});
