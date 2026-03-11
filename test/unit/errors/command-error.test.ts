import { describe, it, expect } from "vitest";
import { CommandError } from "../../../src/errors/command-error.js";

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
  });

  describe("toJsonData()", () => {
    it("should include error message", () => {
      const err = new CommandError("test error");
      expect(err.toJsonData()).toEqual({ error: "test error" });
    });

    it("should include code when present", () => {
      const err = new CommandError("auth error", { code: 40100 });
      expect(err.toJsonData()).toEqual({ error: "auth error", code: 40100 });
    });

    it("should include statusCode when present", () => {
      const err = new CommandError("auth error", {
        code: 40100,
        statusCode: 401,
      });
      expect(err.toJsonData()).toEqual({
        error: "auth error",
        code: 40100,
        statusCode: 401,
      });
    });

    it("should include context fields", () => {
      const err = new CommandError("failed", {
        code: 40400,
        context: { appId: "abc", channel: "test" },
      });
      expect(err.toJsonData()).toEqual({
        error: "failed",
        code: 40400,
        appId: "abc",
        channel: "test",
      });
    });

    it("should omit code and statusCode when undefined", () => {
      const err = new CommandError("plain error");
      const data = err.toJsonData();
      expect(data).not.toHaveProperty("code");
      expect(data).not.toHaveProperty("statusCode");
    });
  });
});
