import {
  describe,
  it,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  expect,
} from "vitest";
import {
  E2E_API_KEY,
  SHOULD_SKIP_E2E,
  forceExit,
  cleanupTrackedResources,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import { runCommand } from "../../helpers/command-helpers.js";
import { parseNdjsonLines } from "../../helpers/ndjson.js";

describe.skipIf(SHOULD_SKIP_E2E)("Auth Tokens E2E Tests", () => {
  beforeAll(() => {
    process.on("SIGINT", forceExit);
  });

  afterAll(() => {
    process.removeListener("SIGINT", forceExit);
  });

  beforeEach(() => {
    resetTestTracking();
  });

  afterEach(async () => {
    await cleanupTrackedResources();
  });

  describe("auth issue-ably-token", () => {
    it("should issue an Ably token with --json", async () => {
      setupTestFailureHandler("should issue an Ably token with --json");

      const result = await runCommand(["auth", "issue-ably-token", "--json"], {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 30000,
      });

      expect(result.exitCode).toBe(0);

      const records = parseNdjsonLines(result.stdout);
      const resultRecord = records.find((r) => r.type === "result");

      expect(resultRecord).toBeDefined();
      expect(resultRecord!.success).toBe(true);

      const token = resultRecord!.token as Record<string, unknown>;
      expect(token).toBeDefined();
      expect(token.value).toBeDefined();
      expect(typeof token.value).toBe("string");
      expect((token.value as string).length).toBeGreaterThan(0);
      expect(token.issuedAt).toBeDefined();
      expect(token.expiresAt).toBeDefined();
      expect(token.capability).toBeDefined();
    });
  });

  describe("auth issue-jwt-token", () => {
    it("should issue a JWT token with --json", async () => {
      setupTestFailureHandler("should issue a JWT token with --json");

      const result = await runCommand(["auth", "issue-jwt-token", "--json"], {
        env: { ABLY_API_KEY: E2E_API_KEY || "" },
        timeoutMs: 30000,
      });

      expect(result.exitCode).toBe(0);

      const records = parseNdjsonLines(result.stdout);
      const resultRecord = records.find((r) => r.type === "result");

      expect(resultRecord).toBeDefined();
      expect(resultRecord!.success).toBe(true);

      const token = resultRecord!.token as Record<string, unknown>;
      expect(token).toBeDefined();
      expect(token.value).toBeDefined();
      expect(typeof token.value).toBe("string");

      // JWT tokens have three dot-separated parts (header.payload.signature)
      const jwtValue = token.value as string;
      const parts = jwtValue.split(".");
      expect(parts).toHaveLength(3);

      expect(token.tokenType).toBe("jwt");
      expect(token.appId).toBeDefined();
      expect(token.keyId).toBeDefined();
    });
  });

  describe("auth revoke-token", () => {
    it("should issue a token and then revoke it", async () => {
      setupTestFailureHandler("should issue a token and then revoke it");

      // Step 1: Issue an Ably token with a known client ID
      const issueResult = await runCommand(
        [
          "auth",
          "issue-ably-token",
          "--json",
          "--client-id",
          "e2e-revoke-test",
        ],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(issueResult.exitCode).toBe(0);

      const issueRecords = parseNdjsonLines(issueResult.stdout);
      const issueResultRecord = issueRecords.find((r) => r.type === "result");

      expect(issueResultRecord).toBeDefined();
      const issuedToken = issueResultRecord!.token as Record<string, unknown>;
      expect(issuedToken.value).toBeDefined();

      const tokenValue = issuedToken.value as string;

      // Step 2: Revoke the token using its client ID
      const revokeResult = await runCommand(
        [
          "auth",
          "revoke-token",
          tokenValue,
          "--client-id",
          "e2e-revoke-test",
          "--json",
        ],
        {
          env: { ABLY_API_KEY: E2E_API_KEY || "" },
          timeoutMs: 30000,
        },
      );

      expect(revokeResult.exitCode).toBe(0);

      const revokeRecords = parseNdjsonLines(revokeResult.stdout);
      const revokeResultRecord = revokeRecords.find((r) => r.type === "result");

      expect(revokeResultRecord).toBeDefined();
      expect(revokeResultRecord!.success).toBe(true);
    });
  });
});
