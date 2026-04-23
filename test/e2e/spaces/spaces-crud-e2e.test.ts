import { describe, it, beforeEach, afterEach, expect } from "vitest";
import {
  E2E_API_KEY,
  SHOULD_SKIP_E2E,
  getUniqueChannelName,
  getUniqueClientId,
  cleanupTrackedResources,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import {
  runCommand,
  startSubscribeCommand,
  cleanupRunners,
} from "../../helpers/command-helpers.js";
import type { CliRunner } from "../../helpers/cli-runner.js";
import { parseNdjsonLines } from "../../helpers/ndjson.js";

describe.skipIf(SHOULD_SKIP_E2E)("Spaces CRUD E2E Tests", () => {
  let spaceName: string;
  let clientId: string;

  beforeEach(() => {
    resetTestTracking();
    spaceName = getUniqueChannelName("space");
    clientId = getUniqueClientId("space-client");
  });

  afterEach(async () => {
    await cleanupTrackedResources();
  });

  describe("spaces create", () => {
    it("should create a space", async () => {
      setupTestFailureHandler("should create a space");

      const result = await runCommand(
        ["spaces", "create", spaceName, "--client-id", clientId, "--json"],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(result.exitCode).toBe(0);

      const records = parseNdjsonLines(result.stdout);
      const resultRecord = records.find((r) => r.type === "result");
      expect(resultRecord).toBeDefined();
      expect(resultRecord!.success).toBe(true);
      const space = resultRecord!.space as { name: string };
      expect(space).toBeDefined();
      expect(space.name).toBe(spaceName);
    });
  });

  describe("spaces list", () => {
    it("should list spaces", async () => {
      setupTestFailureHandler("should list spaces");

      const result = await runCommand(["spaces", "list", "--json"], {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 15000,
      });

      // Should succeed even if the list is empty
      expect(result.exitCode).toBe(0);

      const records = parseNdjsonLines(result.stdout);
      const resultRecord = records.find((r) => r.type === "result");
      expect(resultRecord).toBeDefined();
      expect(resultRecord!.success).toBe(true);
      expect(Array.isArray(resultRecord!.spaces)).toBe(true);
      expect(resultRecord).toHaveProperty("total");
      expect(resultRecord).toHaveProperty("hasMore");
    });
  });

  describe("spaces get", () => {
    it("should get space details", { timeout: 60000 }, async () => {
      setupTestFailureHandler("should get space details");

      let member: CliRunner | null = null;

      try {
        // Enter a member into the space and keep it present (spaces only exist while members are present)
        member = await startSubscribeCommand(
          [
            "spaces",
            "members",
            "enter",
            spaceName,
            "--client-id",
            clientId,
            "--duration",
            "30",
          ],
          /Holding presence/,
          {
            env: { ABLY_API_KEY: E2E_API_KEY || "" },
            timeoutMs: 30000,
          },
        );

        // Get space details while the member is still present
        const result = await runCommand(
          ["spaces", "get", spaceName, "--json"],
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
        const space = resultRecord!.space as {
          name: string;
          members: Array<{ clientId: string }>;
        };
        expect(space).toBeDefined();
        expect(space.name).toBe(spaceName);
        expect(Array.isArray(space.members)).toBe(true);
        expect(space.members.length).toBeGreaterThan(0);
        expect(space.members[0].clientId).toBe(clientId);
      } finally {
        if (member) {
          await cleanupRunners([member]);
        }
      }
    });
  });
});
