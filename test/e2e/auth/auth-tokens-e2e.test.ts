import { randomUUID } from "node:crypto";

import { describe, it, beforeEach, afterEach, expect } from "vitest";
import jwt from "jsonwebtoken";
import { runCommand } from "../../helpers/command-helpers.js";
import {
  E2E_API_KEY,
  SHOULD_SKIP_E2E,
  cleanupTrackedResources,
  setupTestFailureHandler,
  resetTestTracking,
} from "../../helpers/e2e-test-helper.js";
import { parseNdjsonLines } from "../../helpers/ndjson.js";

// Probe whether the E2E key has the revocableTokens attribute.
// Error 40164 means it does not; runs once at module load so describe.skipIf can use the result.
const revocationSupported =
  !SHOULD_SKIP_E2E &&
  (await (async () => {
    const probe = await runCommand(
      [
        "auth",
        "revoke-token",
        "--client-id",
        "__revocation-probe__",
        "--json",
        "--force",
      ],
      { env: { ABLY_API_KEY: E2E_API_KEY || "" }, timeoutMs: 10000 },
    );
    const records = parseNdjsonLines(probe.stdout);
    const errorRecord = records.find((r) => r.type === "error");
    const errObj = errorRecord?.error as Record<string, unknown> | undefined;
    const msg = String(errObj?.message ?? "");
    return !msg.includes("40164") && !msg.includes("revocableTokens");
  })());

describe.skipIf(SHOULD_SKIP_E2E)("Auth Tokens E2E Tests", () => {
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

  describe.skipIf(!revocationSupported)("auth revoke-token", () => {
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

      // Step 2: Revoke tokens for the client ID (token positional arg removed — API revokes by target specifier)
      const revokeResult = await runCommand(
        [
          "auth",
          "revoke-token",
          "--client-id",
          "e2e-revoke-test",
          "--json",
          "--force",
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
      expect(revokeResultRecord!.revocation).toBeDefined();
      expect(
        (revokeResultRecord!.revocation as Record<string, unknown>).target,
      ).toBe("clientId:e2e-revoke-test");
    });

    it("should issue a JWT with revocation key, then revoke by that key", async () => {
      setupTestFailureHandler(
        "should issue a JWT with revocation key, then revoke by that key",
      );

      const apiKey = E2E_API_KEY || "";
      const [keyId, keySecret] = apiKey.split(":");
      const appId = keyId!.split(".")[0];
      const revocationKey = `e2e-revoke-group-${Date.now()}`;

      // Step 1: Manually create a JWT with the x-ably-revocation-key claim
      const jwtToken = jwt.sign(
        {
          "x-ably-appId": appId,
          "x-ably-capability": { "*": ["*"] },
          "x-ably-clientId": `e2e-revoke-key-client-${randomUUID().slice(0, 8)}`,
          "x-ably-revocation-key": revocationKey,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          jti: randomUUID(),
        },
        keySecret!,
        { algorithm: "HS256", keyid: keyId },
      );

      // Step 2: Verify the JWT is valid by subscribing briefly with it
      const subscribeResult = await runCommand(
        ["channels", "subscribe", "e2e-revoke-key-test", "--json"],
        {
          env: { ABLY_TOKEN: jwtToken },
          timeoutMs: 5000,
        },
      );

      // The subscribe auto-exits via ABLY_CLI_DEFAULT_DURATION or timeout;
      // we just need it to have connected (exit 0 or timeout is fine)
      expect([0, null]).toContain(subscribeResult.exitCode);

      // Step 3: Revoke by revocation key
      const revokeResult = await runCommand(
        [
          "auth",
          "revoke-token",
          "--revocation-key",
          revocationKey,
          "--json",
          "--force",
        ],
        {
          env: { ABLY_API_KEY: apiKey },
          timeoutMs: 30000,
        },
      );

      expect(revokeResult.exitCode).toBe(0);

      const revokeRecords = parseNdjsonLines(revokeResult.stdout);
      const revokeResultRecord = revokeRecords.find((r) => r.type === "result");

      expect(revokeResultRecord).toBeDefined();
      expect(revokeResultRecord!.success).toBe(true);
      expect(revokeResultRecord!.revocation).toBeDefined();
      expect(
        (revokeResultRecord!.revocation as Record<string, unknown>).target,
      ).toBe(`revocationKey:${revocationKey}`);
    });

    it("should revoke tokens with --allow-reauth-margin", async () => {
      setupTestFailureHandler(
        "should revoke tokens with --allow-reauth-margin",
      );

      const revokeResult = await runCommand(
        [
          "auth",
          "revoke-token",
          "--client-id",
          "e2e-reauth-test",
          "--allow-reauth-margin",
          "--json",
          "--force",
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

      const revocation = revokeResultRecord!.revocation as Record<
        string,
        unknown
      >;
      expect(revocation.target).toBe("clientId:e2e-reauth-test");
      expect(revocation.allowReauthMargin).toBe(true);
    });
  });
});
