import { describe, it, expect } from "vitest";
import {
  errorMessage,
  errorWithReason,
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

describe("errorWithReason", () => {
  it("keeps the reason's code, status code and help URL", () => {
    const error = errorWithReason("Connection failed: nope", {
      code: 40012,
      statusCode: 400,
      href: "https://help.ably.io/error/40012",
    });

    expect(error).toMatchObject({
      message: "Connection failed: nope",
      code: 40012,
      statusCode: 400,
      href: "https://help.ably.io/error/40012",
    });
  });
});

describe("getFriendlyAblyErrorHint", () => {
  it("returns undefined for unknown codes", () => {
    expect(getFriendlyAblyErrorHint(12345)).toBeUndefined();
  });

  it.each([40012, 40161, 91000])(
    "points %i at --client-id only when the command has it",
    (code) => {
      expect(
        getFriendlyAblyErrorHint(code, { hasClientIdFlag: true }),
      ).toContain("--client-id or the ABLY_CLIENT_ID");
      expect(getFriendlyAblyErrorHint(code, {})).not.toContain("--client-id");
      expect(getFriendlyAblyErrorHint(code, {})).toContain("ABLY_CLIENT_ID");
    },
  );

  it.each([40012, 40161, 91000])(
    "points %i at re-issuing the token under token auth",
    (code) => {
      expect(
        getFriendlyAblyErrorHint(code, {
          tokenAuth: true,
          hasClientIdFlag: true,
        }),
      ).toContain("re-issue it");
    },
  );
});
