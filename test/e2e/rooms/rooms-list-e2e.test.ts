import { describe, it, beforeEach, afterEach, expect } from "vitest";
import {
  E2E_API_KEY,
  SHOULD_SKIP_E2E,
  cleanupTrackedResources,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import { runCommand } from "../../helpers/command-helpers.js";
import { parseNdjsonLines } from "../../helpers/ndjson.js";

describe.skipIf(SHOULD_SKIP_E2E)("Rooms List E2E Tests", () => {
  beforeEach(() => {
    resetTestTracking();
  });

  afterEach(async () => {
    await cleanupTrackedResources();
  });

  describe("rooms list", () => {
    it("should list rooms", async () => {
      setupTestFailureHandler("should list rooms");

      const result = await runCommand(["rooms", "list", "--json"], {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 15000,
      });

      // Should succeed even if the list is empty
      expect(result.exitCode).toBe(0);

      const records = parseNdjsonLines(result.stdout);
      const resultRecord = records.find((r) => r.type === "result");
      expect(resultRecord).toBeDefined();
      expect(resultRecord!.success).toBe(true);
      expect(Array.isArray(resultRecord!.rooms)).toBe(true);
      expect(resultRecord).toHaveProperty("total");
      expect(resultRecord).toHaveProperty("hasMore");
    });

    it("should list rooms with limit", async () => {
      setupTestFailureHandler("should list rooms with limit");

      const result = await runCommand(
        ["rooms", "list", "--limit", "5", "--json"],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 15000,
        },
      );

      expect(result.exitCode).toBe(0);

      const records = parseNdjsonLines(result.stdout);
      const resultRecord = records.find((r) => r.type === "result");
      expect(resultRecord).toBeDefined();
      expect(resultRecord!.success).toBe(true);
      expect(Array.isArray(resultRecord!.rooms)).toBe(true);
      expect(resultRecord).toHaveProperty("total");
      expect(resultRecord).toHaveProperty("hasMore");
    });
  });
});
