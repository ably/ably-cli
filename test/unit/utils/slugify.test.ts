import { describe, it, expect } from "vitest";
import { slugifyAccountName } from "../../../src/utils/slugify.js";

describe("slugifyAccountName", () => {
  it("lowercases and replaces spaces with dashes", () => {
    expect(slugifyAccountName("My Account")).toBe("my-account");
  });

  it("strips leading and trailing dashes", () => {
    expect(slugifyAccountName("  My Account  ")).toBe("my-account");
  });

  it("replaces non-alphanumeric characters with dashes", () => {
    expect(slugifyAccountName("Ably (Production)")).toBe("ably-production");
  });

  it("collapses consecutive non-alphanumeric to single dash", () => {
    expect(slugifyAccountName("foo---bar")).toBe("foo-bar");
  });

  it("returns 'default' for empty string", () => {
    expect(slugifyAccountName("")).toBe("default");
  });

  it("returns 'default' for whitespace-only string", () => {
    expect(slugifyAccountName("   ")).toBe("default");
  });

  it("prefixes with 'account-' when name starts with a number", () => {
    expect(slugifyAccountName("123 Corp")).toBe("account-123-corp");
  });

  it("prefixes with 'account-' when name starts with a dash after cleanup", () => {
    expect(slugifyAccountName("--test")).toBe("test");
  });

  it("handles single letter name", () => {
    expect(slugifyAccountName("a")).toBe("a");
  });

  it("handles purely numeric name", () => {
    expect(slugifyAccountName("12345")).toBe("account-12345");
  });

  it("maps unicode characters via the slugify charmap", () => {
    expect(slugifyAccountName("André's Co")).toBe("andres-co");
  });
});
