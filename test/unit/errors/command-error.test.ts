import { describe, it, expect } from "vitest";
import { CommandError } from "../../../src/errors/command-error.js";
import { extractErrorInfo } from "../../../src/utils/errors.js";

describe("CommandError", () => {
  describe("constructor", () => {
    it("should create error with message only", () => {
      const err = new CommandError("something broke");
      expect(err.message).toBe("something broke");
      expect(err.name).toBe("CommandError");
      expect(err.code).toBeUndefined();
      expect(err.statusCode).toBeUndefined();
      expect(err.context).toEqual({});
    });

    it("should create error with all options", () => {
      const cause = new Error("root cause");
      const err = new CommandError("auth failed", {
        code: 40100,
        statusCode: 401,
        context: { appId: "abc123" },
        cause,
      });
      expect(err.message).toBe("auth failed");
      expect(err.code).toBe(40100);
      expect(err.statusCode).toBe(401);
      expect(err.context).toEqual({ appId: "abc123" });
      expect(err.cause).toBe(cause);
    });

    it("should default context to empty object", () => {
      const err = new CommandError("test", { code: 123 });
      expect(err.context).toEqual({});
    });
  });

  describe("from()", () => {
    it("should pass through CommandError unchanged when no extra context", () => {
      const original = new CommandError("test", {
        code: 40100,
        statusCode: 401,
      });
      const result = CommandError.from(original);
      expect(result).toBe(original); // same reference
    });

    it("should merge context into existing CommandError", () => {
      const original = new CommandError("test", {
        code: 40100,
        statusCode: 401,
        context: { existing: true },
      });
      const result = CommandError.from(original, { appId: "xyz" });
      expect(result).not.toBe(original); // new instance
      expect(result.message).toBe("test");
      expect(result.code).toBe(40100);
      expect(result.statusCode).toBe(401);
      expect(result.context).toEqual({ existing: true, appId: "xyz" });
    });

    it("should extract code and statusCode from Ably ErrorInfo-like errors", () => {
      const ablyError = Object.assign(new Error("Unauthorized"), {
        code: 40100,
        statusCode: 401,
      });
      const result = CommandError.from(ablyError);
      expect(result.message).toBe("Unauthorized");
      expect(result.code).toBe(40100);
      expect(result.statusCode).toBe(401);
      expect(result.cause).toBe(ablyError);
    });

    it("should extract numeric code from Error with code only", () => {
      const err = Object.assign(new Error("Connection timeout"), {
        code: 80003,
      });
      const result = CommandError.from(err);
      expect(result.message).toBe("Connection timeout");
      expect(result.code).toBe(80003);
      expect(result.statusCode).toBeUndefined();
      expect(result.cause).toBe(err);
    });

    it("should ignore non-numeric code on Error", () => {
      const err = Object.assign(new Error("ENOENT"), {
        code: "ENOENT",
      });
      const result = CommandError.from(err);
      expect(result.message).toBe("ENOENT");
      expect(result.code).toBeUndefined();
      expect(result.cause).toBe(err);
    });

    it("should wrap plain Error with message only", () => {
      const err = new Error("something failed");
      const result = CommandError.from(err);
      expect(result.message).toBe("something failed");
      expect(result.code).toBeUndefined();
      expect(result.statusCode).toBeUndefined();
      expect(result.cause).toBe(err);
    });

    it("should wrap string as CommandError", () => {
      const result = CommandError.from("bad input");
      expect(result.message).toBe("bad input");
      expect(result.code).toBeUndefined();
      expect(result.cause).toBeUndefined();
    });

    it("should extract message and code from plain error object", () => {
      const plainError = { message: "Invalid message format", code: 40000 };
      const result = CommandError.from(plainError);
      expect(result.message).toBe("Invalid message format");
      expect(result.code).toBe(40000);
      expect(result.statusCode).toBeUndefined();
    });

    it("should extract message, code, and statusCode from plain error object", () => {
      const plainError = {
        message: "Unauthorized",
        code: 40101,
        statusCode: 401,
      };
      const result = CommandError.from(plainError);
      expect(result.message).toBe("Unauthorized");
      expect(result.code).toBe(40101);
      expect(result.statusCode).toBe(401);
    });

    it("should handle plain object with message only", () => {
      const plainError = { message: "Something went wrong" };
      const result = CommandError.from(plainError);
      expect(result.message).toBe("Something went wrong");
      expect(result.code).toBeUndefined();
      expect(result.statusCode).toBeUndefined();
    });

    it("should not treat objects without message as plain error objects", () => {
      const notAnError = { code: 123, data: "test" };
      const result = CommandError.from(notAnError);
      expect(result.message).toBe("[object Object]");
    });

    it("should wrap unknown values via String()", () => {
      const result = CommandError.from(42);
      expect(result.message).toBe("42");
    });

    it("should wrap null via String()", () => {
      const result = CommandError.from(null);
      expect(result.message).toBe("null");
    });

    it("should wrap undefined via String()", () => {
      const result = CommandError.from();
      expect(result.message).toBe("undefined");
    });

    it("should attach context from second argument", () => {
      const result = CommandError.from("test error", { channel: "my-channel" });
      expect(result.message).toBe("test error");
      expect(result.context).toEqual({ channel: "my-channel" });
    });

    it("should attach context to Ably ErrorInfo-like errors", () => {
      const ablyError = Object.assign(new Error("Not Found"), {
        code: 40400,
        statusCode: 404,
      });
      const result = CommandError.from(ablyError, { appId: "abc" });
      expect(result.code).toBe(40400);
      expect(result.statusCode).toBe(404);
      expect(result.context).toEqual({ appId: "abc" });
    });

    it("should extract href as helpUrl from Ably ErrorInfo-like errors with code and statusCode", () => {
      const ablyError = Object.assign(new Error("Unauthorized"), {
        code: 40100,
        statusCode: 401,
        href: "https://help.ably.io/error/40100",
      });
      const result = CommandError.from(ablyError);
      expect(result.code).toBe(40100);
      expect(result.statusCode).toBe(401);
      expect(result.context.helpUrl).toBe("https://help.ably.io/error/40100");
    });

    it("should extract href as helpUrl from errors with code only", () => {
      const err = Object.assign(new Error("Connection failed"), {
        code: 80003,
        href: "https://help.ably.io/error/80003",
      });
      const result = CommandError.from(err);
      expect(result.code).toBe(80003);
      expect(result.context.helpUrl).toBe("https://help.ably.io/error/80003");
    });

    it("should merge href-derived helpUrl with provided context", () => {
      const ablyError = Object.assign(new Error("Not Found"), {
        code: 40400,
        statusCode: 404,
        href: "https://help.ably.io/error/40400",
      });
      const result = CommandError.from(ablyError, { appId: "abc" });
      expect(result.code).toBe(40400);
      expect(result.context).toEqual({
        appId: "abc",
        helpUrl: "https://help.ably.io/error/40400",
      });
    });

    it("should not add helpUrl when href is absent", () => {
      const ablyError = Object.assign(new Error("Unauthorized"), {
        code: 40100,
        statusCode: 401,
      });
      const result = CommandError.from(ablyError);
      expect(result.context.helpUrl).toBeUndefined();
    });
  });

  describe("fromHttpResponse()", () => {
    it("should extract errorCode, errorMessage, and statusCode", () => {
      const response = {
        statusCode: 401,
        errorCode: 40101,
        errorMessage: "Invalid credentials",
      };
      const result = CommandError.fromHttpResponse(
        response,
        "Failed to list channels",
      );
      expect(result.message).toBe("Invalid credentials");
      expect(result.code).toBe(40101);
      expect(result.statusCode).toBe(401);
    });

    it("should fall back to action message when errorMessage is empty", () => {
      const response = {
        statusCode: 500,
        errorCode: 0,
        errorMessage: "",
      };
      const result = CommandError.fromHttpResponse(
        response,
        "Failed to list spaces",
      );
      expect(result.message).toBe("Failed to list spaces (status 500)");
      expect(result.code).toBeUndefined();
      expect(result.statusCode).toBe(500);
    });

    it("should set code to undefined when errorCode is 0", () => {
      const response = {
        statusCode: 500,
        errorCode: 0,
        errorMessage: "Internal server error",
      };
      const result = CommandError.fromHttpResponse(
        response,
        "Failed to list rooms",
      );
      expect(result.message).toBe("Internal server error");
      expect(result.code).toBeUndefined();
      expect(result.statusCode).toBe(500);
    });

    it("should preserve non-zero errorCode", () => {
      const response = {
        statusCode: 403,
        errorCode: 40160,
        errorMessage: "Action not permitted",
      };
      const result = CommandError.fromHttpResponse(
        response,
        "Failed to fetch space",
      );
      expect(result.code).toBe(40160);
      expect(result.statusCode).toBe(403);
    });
  });

  describe("toJsonData()", () => {
    it("should nest error data under error key with message field", () => {
      const err = new CommandError("test error");
      expect(err.toJsonData()).toEqual({
        error: { message: "test error" },
      });
    });

    it("should include code when present", () => {
      const err = new CommandError("auth error", { code: 40100 });
      expect(err.toJsonData()).toEqual({
        error: { message: "auth error", code: 40100 },
      });
    });

    it("should include statusCode when present", () => {
      const err = new CommandError("auth error", {
        code: 40100,
        statusCode: 401,
      });
      expect(err.toJsonData()).toEqual({
        error: { message: "auth error", code: 40100, statusCode: 401 },
      });
    });

    it("should include context fields at top level, not inside error object", () => {
      const err = new CommandError("failed", {
        code: 40400,
        context: { appId: "abc", channel: "test" },
      });
      expect(err.toJsonData()).toEqual({
        error: { message: "failed", code: 40400 },
        appId: "abc",
        channel: "test",
      });
    });

    it("should include hint in error object when provided", () => {
      const err = new CommandError("auth error", {
        code: 40100,
        statusCode: 401,
      });
      expect(err.toJsonData("Check your API key.")).toEqual({
        error: {
          message: "auth error",
          code: 40100,
          statusCode: 401,
          hint: "Check your API key.",
        },
      });
    });

    it("should omit hint when not provided", () => {
      const err = new CommandError("auth error", { code: 40100 });
      const data = err.toJsonData();
      const errorObj = data.error as Record<string, unknown>;
      expect(errorObj).not.toHaveProperty("hint");
    });

    it("should omit code and statusCode when undefined", () => {
      const err = new CommandError("plain error");
      const data = err.toJsonData();
      const errorObj = data.error as Record<string, unknown>;
      expect(errorObj).not.toHaveProperty("code");
      expect(errorObj).not.toHaveProperty("statusCode");
    });

    it("should produce no undefined values in serialized JSON", () => {
      const err = new CommandError("plain error");
      const json = JSON.stringify(err.toJsonData());
      expect(json).not.toContain("undefined");
      const parsed = JSON.parse(json);
      expect(parsed).toEqual({ error: { message: "plain error" } });
    });

    it("should produce clean JSON with all fields when fully populated", () => {
      const err = new CommandError("Unauthorized", {
        code: 40100,
        statusCode: 401,
        context: { appId: "abc", helpUrl: "https://help.ably.io/error/40100" },
      });
      const json = JSON.stringify(err.toJsonData());
      const parsed = JSON.parse(json);
      expect(parsed).toEqual({
        error: { message: "Unauthorized", code: 40100, statusCode: 401 },
        appId: "abc",
        helpUrl: "https://help.ably.io/error/40100",
      });
      // Verify no stray keys at wrong level
      expect(parsed.error).not.toHaveProperty("appId");
      expect(parsed.error).not.toHaveProperty("helpUrl");
      expect(parsed).not.toHaveProperty("message");
      expect(parsed).not.toHaveProperty("code");
      expect(parsed).not.toHaveProperty("statusCode");
    });
  });
});

describe("extractErrorInfo", () => {
  it("should extract message from plain Error", () => {
    const err = new Error("something broke");
    expect(extractErrorInfo(err)).toEqual({ message: "something broke" });
  });

  it("should extract code and statusCode from Ably ErrorInfo-like error", () => {
    const err = Object.assign(new Error("Unauthorized"), {
      code: 40100,
      statusCode: 401,
    });
    expect(extractErrorInfo(err)).toEqual({
      message: "Unauthorized",
      code: 40100,
      statusCode: 401,
    });
  });

  it("should extract code without statusCode when only code is present", () => {
    const err = Object.assign(new Error("Connection timeout"), { code: 80003 });
    expect(extractErrorInfo(err)).toEqual({
      message: "Connection timeout",
      code: 80003,
    });
  });

  it("should ignore non-numeric code", () => {
    const err = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    expect(extractErrorInfo(err)).toEqual({ message: "ENOENT" });
  });

  it("should wrap string values", () => {
    expect(extractErrorInfo("bad input")).toEqual({ message: "bad input" });
  });

  it("should wrap non-Error objects via String()", () => {
    expect(extractErrorInfo(42)).toEqual({ message: "42" });
    expect(extractErrorInfo(null)).toEqual({ message: "null" });
  });

  it("should omit code and statusCode from serialized JSON when absent", () => {
    const result = extractErrorInfo(new Error("plain"));
    const json = JSON.stringify(result);
    expect(json).not.toContain("code");
    expect(json).not.toContain("statusCode");
    expect(JSON.parse(json)).toEqual({ message: "plain" });
  });

  it("should extract href from Ably ErrorInfo-like error", () => {
    const err = Object.assign(new Error("Not found"), {
      code: 40400,
      statusCode: 404,
      href: "https://help.ably.io/error/40400",
    });
    expect(extractErrorInfo(err)).toEqual({
      message: "Not found",
      code: 40400,
      statusCode: 404,
      href: "https://help.ably.io/error/40400",
    });
  });

  it("should omit href when not present", () => {
    const err = new Error("plain");
    expect(extractErrorInfo(err)).toEqual({ message: "plain" });
  });

  it("should include all fields in serialized JSON when present", () => {
    const err = Object.assign(new Error("Forbidden"), {
      code: 40300,
      statusCode: 403,
    });
    const result = extractErrorInfo(err);
    const json = JSON.stringify(result);
    expect(JSON.parse(json)).toEqual({
      message: "Forbidden",
      code: 40300,
      statusCode: 403,
    });
  });
});
