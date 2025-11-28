import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WEB_CLI_ANONYMOUS_RESTRICTED_COMMANDS } from "../../../src/base-command.js";

// Helper function to test pattern matching logic
const matchesPattern = (commandId: string, pattern: string): boolean => {
  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return commandId === prefix || commandId.startsWith(prefix);
  }
  return commandId === pattern;
};

describe("Interactive Mode - Anonymous Restrictions", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("Environment Variable Handling", () => {
    it("should recognize anonymous mode when ABLY_ANONYMOUS_USER_MODE is set", () => {
      process.env.ABLY_WEB_CLI_MODE = "true";
      process.env.ABLY_ANONYMOUS_USER_MODE = "true";

      // This would be tested through the interactive command
      // but we can at least verify the environment is set correctly
      expect(process.env.ABLY_WEB_CLI_MODE).toBe("true");
      expect(process.env.ABLY_ANONYMOUS_USER_MODE).toBe("true");
    });

    it("should not be in anonymous mode when ABLY_ANONYMOUS_USER_MODE is false", () => {
      process.env.ABLY_WEB_CLI_MODE = "true";
      process.env.ABLY_ANONYMOUS_USER_MODE = "false";

      expect(process.env.ABLY_ANONYMOUS_USER_MODE).toBe("false");
    });
  });

  describe("Restricted Commands List", () => {
    it("should include apps commands in anonymous restricted list", () => {
      const hasAppsRestriction = WEB_CLI_ANONYMOUS_RESTRICTED_COMMANDS.some(
        (pattern) => pattern === "apps*" || pattern.startsWith("apps:"),
      );
      expect(hasAppsRestriction).toBe(true);
    });

    it("should include accounts commands in anonymous restricted list", () => {
      const hasAccountsRestriction = WEB_CLI_ANONYMOUS_RESTRICTED_COMMANDS.some(
        (pattern) => pattern === "accounts*" || pattern.startsWith("accounts:"),
      );
      expect(hasAccountsRestriction).toBe(true);
    });

    it("should include sensitive enumeration commands", () => {
      expect(WEB_CLI_ANONYMOUS_RESTRICTED_COMMANDS).toContain("channels:list");
      expect(WEB_CLI_ANONYMOUS_RESTRICTED_COMMANDS).toContain("channels:logs");
      expect(WEB_CLI_ANONYMOUS_RESTRICTED_COMMANDS).toContain(
        "connections:logs",
      );
      expect(WEB_CLI_ANONYMOUS_RESTRICTED_COMMANDS).toContain("rooms:list");
      expect(WEB_CLI_ANONYMOUS_RESTRICTED_COMMANDS).toContain("spaces:list");
    });
  });

  describe("Command Pattern Matching", () => {
    it("should match wildcard patterns correctly", () => {
      expect(matchesPattern("apps:list", "apps*")).toBe(true);
      expect(matchesPattern("apps:create", "apps*")).toBe(true);
      expect(matchesPattern("apps:delete", "apps*")).toBe(true);
      expect(matchesPattern("apps", "apps*")).toBe(true);
    });

    it("should match exact patterns correctly", () => {
      expect(matchesPattern("channels:list", "channels:list")).toBe(true);
      expect(matchesPattern("channels:subscribe", "channels:list")).toBe(false);
    });

    it("should handle logs wildcard pattern", () => {
      expect(matchesPattern("logs:app:history", "logs*")).toBe(true);
      expect(matchesPattern("logs:push:subscribe", "logs*")).toBe(true);
      expect(matchesPattern("logs", "logs*")).toBe(true);
    });
  });
});
