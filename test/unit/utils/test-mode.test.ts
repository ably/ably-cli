import { describe, it, expect, beforeEach, afterEach } from "vitest";
import isTestMode from "../../../src/utils/test-mode.js";

describe("test-mode utility", function () {
  let originalEnv: string | undefined;

  beforeEach(function () {
    // Save the original environment variable value
    originalEnv = process.env.ABLY_CLI_TEST_MODE;
  });

  afterEach(function () {
    // Restore the original environment variable value
    if (originalEnv === undefined) {
      delete process.env.ABLY_CLI_TEST_MODE;
    } else {
      process.env.ABLY_CLI_TEST_MODE = originalEnv;
    }
  });

  describe("isTestMode", function () {
    it.each([
      {
        value: "true",
        expected: true,
        description: "should return true when ABLY_CLI_TEST_MODE is 'true'",
      },
      {
        value: "false",
        expected: false,
        description: "should return false when ABLY_CLI_TEST_MODE is 'false'",
      },
      {
        value: undefined,
        expected: false,
        description: "should return false when ABLY_CLI_TEST_MODE is not set",
      },
      {
        value: "",
        expected: false,
        description:
          "should return false when ABLY_CLI_TEST_MODE is an empty string",
      },
      {
        value: "1",
        expected: false,
        description: "should return false when ABLY_CLI_TEST_MODE is '1'",
      },
      {
        value: "True",
        expected: false,
        description:
          "should return false when ABLY_CLI_TEST_MODE is 'True' (case-sensitive)",
      },
      {
        value: "TRUE",
        expected: false,
        description:
          "should return false when ABLY_CLI_TEST_MODE is 'TRUE' (case-sensitive)",
      },
    ])("$description", function ({ value, expected }) {
      if (value === undefined) {
        delete process.env.ABLY_CLI_TEST_MODE;
      } else {
        process.env.ABLY_CLI_TEST_MODE = value;
      }
      expect(isTestMode()).toBe(expected);
    });

    it("should return consistent results on multiple calls with same env", function () {
      process.env.ABLY_CLI_TEST_MODE = "true";
      const result1 = isTestMode();
      const result2 = isTestMode();
      const result3 = isTestMode();

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
    });

    it("should return updated results when environment variable changes", function () {
      process.env.ABLY_CLI_TEST_MODE = "true";
      expect(isTestMode()).toBe(true);

      process.env.ABLY_CLI_TEST_MODE = "false";
      expect(isTestMode()).toBe(false);

      delete process.env.ABLY_CLI_TEST_MODE;
      expect(isTestMode()).toBe(false);

      process.env.ABLY_CLI_TEST_MODE = "true";
      expect(isTestMode()).toBe(true);
    });
  });
});
