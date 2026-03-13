import { describe, it, expect } from "vitest";
import {
  errorMessage,
  getFriendlyAblyErrorHint,
} from "../../../src/utils/errors.js";

describe("errorMessage", () => {
  it("should extract message from Error instances", () => {
    expect(errorMessage(new Error("test error"))).toBe("test error");
  });

  it("should stringify non-Error values", () => {
    expect(errorMessage("string error")).toBe("string error");
    expect(errorMessage(42)).toBe("42");
  });
});

describe("getFriendlyAblyErrorHint", () => {
  it("should return capability hint for code 40160", () => {
    const hint = getFriendlyAblyErrorHint(40160);
    expect(hint).toContain("capability");
    expect(hint).toContain("Ably dashboard");
  });

  it("should return publish capability hint for code 40161", () => {
    const hint = getFriendlyAblyErrorHint(40161);
    expect(hint).toContain("publish capability");
  });

  it("should return operation not permitted hint for code 40171", () => {
    const hint = getFriendlyAblyErrorHint(40171);
    expect(hint).toContain("not permitted");
  });

  it("should return invalid credentials hint for code 40101", () => {
    const hint = getFriendlyAblyErrorHint(40101);
    expect(hint).toContain("not valid");
    expect(hint).toContain("ably login");
  });

  it("should return token expired hint for code 40103", () => {
    const hint = getFriendlyAblyErrorHint(40103);
    expect(hint).toContain("expired");
    expect(hint).toContain("ably login");
  });

  it("should return unable to authorize hint for code 40110", () => {
    const hint = getFriendlyAblyErrorHint(40110);
    expect(hint).toContain("Unable to authorize");
  });

  it("should return undefined for unknown error codes", () => {
    expect(getFriendlyAblyErrorHint(99999)).toBeUndefined();
  });

  it("should return undefined when code is not provided", () => {
    expect(getFriendlyAblyErrorHint()).toBeUndefined();
  });
});
