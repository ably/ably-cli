import { describe, it, expect, beforeEach, afterEach } from "vitest";
import isWebCliMode from "../../../src/utils/web-mode.js";

describe("web-mode utility", function () {
  let originalEnv: string | undefined;

  beforeEach(function () {
    // Save the original environment variable value
    originalEnv = process.env.ABLY_WEB_CLI_MODE;
  });

  afterEach(function () {
    // Restore the original environment variable value
    if (originalEnv === undefined) {
      delete process.env.ABLY_WEB_CLI_MODE;
    } else {
      process.env.ABLY_WEB_CLI_MODE = originalEnv;
    }
  });

  describe("isWebCliMode", function () {
    it.each([
      {
        value: "true",
        expected: true,
        description: "should return true when ABLY_WEB_CLI_MODE is 'true'",
      },
      {
        value: "false",
        expected: false,
        description: "should return false when ABLY_WEB_CLI_MODE is 'false'",
      },
      {
        value: undefined,
        expected: false,
        description: "should return false when ABLY_WEB_CLI_MODE is not set",
      },
      {
        value: "",
        expected: false,
        description:
          "should return false when ABLY_WEB_CLI_MODE is an empty string",
      },
      {
        value: "1",
        expected: false,
        description: "should return false when ABLY_WEB_CLI_MODE is '1'",
      },
      {
        value: "True",
        expected: false,
        description:
          "should return false when ABLY_WEB_CLI_MODE is 'True' (case-sensitive)",
      },
      {
        value: "TRUE",
        expected: false,
        description:
          "should return false when ABLY_WEB_CLI_MODE is 'TRUE' (case-sensitive)",
      },
    ])("$description", function ({ value, expected }) {
      if (value === undefined) {
        delete process.env.ABLY_WEB_CLI_MODE;
      } else {
        process.env.ABLY_WEB_CLI_MODE = value;
      }
      expect(isWebCliMode()).toBe(expected);
    });

    it("should return consistent results on multiple calls with same env", function () {
      process.env.ABLY_WEB_CLI_MODE = "true";
      const result1 = isWebCliMode();
      const result2 = isWebCliMode();
      const result3 = isWebCliMode();

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
    });

    it("should return updated results when environment variable changes", function () {
      process.env.ABLY_WEB_CLI_MODE = "true";
      expect(isWebCliMode()).toBe(true);

      process.env.ABLY_WEB_CLI_MODE = "false";
      expect(isWebCliMode()).toBe(false);

      delete process.env.ABLY_WEB_CLI_MODE;
      expect(isWebCliMode()).toBe(false);

      process.env.ABLY_WEB_CLI_MODE = "true";
      expect(isWebCliMode()).toBe(true);
    });
  });
});
