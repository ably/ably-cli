import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";
import { getMockAblyRealtime } from "../../../helpers/mock-ably-realtime.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";
import { parseNdjsonLines } from "../../../helpers/ndjson.js";

describe("auth:revoke-token command", () => {
  const mockToken = "test-token-12345";
  const mockClientId = "test-client-id";

  beforeEach(() => {
    nock.cleanAll();
    // Initialize the mock (command creates one but doesn't use it for HTTP)
    getMockAblyRealtime();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  standardHelpTests("auth:revoke-token", import.meta.url);

  standardArgValidationTests("auth:revoke-token", import.meta.url, {
    requiredArgs: ["test-token"],
  });

  describe("token revocation", () => {
    it("should successfully revoke a token with client-id", async () => {
      const mockConfig = getMockConfigManager();
      const keyId = mockConfig.getKeyId()!;
      // Mock the token revocation endpoint
      nock("https://rest.ably.io")
        .post(`/keys/${keyId}/revokeTokens`, {
          targets: [`clientId:${mockClientId}`],
        })
        .reply(200, {});

      const { stderr } = await runCommand(
        [
          "auth:revoke-token",
          mockToken,
          "--client-id",
          mockClientId,
          "--force",
        ],
        import.meta.url,
      );

      expect(stderr).toContain("Token successfully revoked");
    });

    it("should use token as client-id when --client-id not provided", async () => {
      const mockConfig = getMockConfigManager();
      const keyId = mockConfig.getKeyId()!;
      // When no client-id is provided, the token is used as the client-id
      nock("https://rest.ably.io")
        .post(`/keys/${keyId}/revokeTokens`, {
          targets: [`clientId:${mockToken}`],
        })
        .reply(200, {});

      const { stderr } = await runCommand(
        ["auth:revoke-token", mockToken, "--force"],
        import.meta.url,
      );

      // Should show warnings about using token as client-id
      expect(stderr).toContain(
        "Revoking a specific token is only possible if it has a client ID",
      );
      expect(stderr).toContain("Using the token argument as a client ID");
      expect(stderr).toContain("Token successfully revoked");
    });

    it("should output JSON format when --json flag is used", async () => {
      const mockConfig = getMockConfigManager();
      const keyId = mockConfig.getKeyId()!;
      nock("https://rest.ably.io")
        .post(`/keys/${keyId}/revokeTokens`, {
          targets: [`clientId:${mockClientId}`],
        })
        .reply(200, { issuedBefore: 1234567890 });

      const { stdout } = await runCommand(
        [
          "auth:revoke-token",
          mockToken,
          "--client-id",
          mockClientId,
          "--json",
          "--force",
        ],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find((r) => r.type === "result")!;
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("revocation");
      expect(result.revocation).toHaveProperty(
        "message",
        "Token revocation processed successfully",
      );
      expect(result.revocation).toHaveProperty("response");
    });

    it("should handle token not found error with special message", async () => {
      const mockConfig = getMockConfigManager();
      const keyId = mockConfig.getKeyId()!;
      // The command handles token_not_found specifically in the response body
      nock("https://rest.ably.io")
        .post(`/keys/${keyId}/revokeTokens`)
        .reply(404, "token_not_found");

      const { error } = await runCommand(
        [
          "auth:revoke-token",
          mockToken,
          "--client-id",
          mockClientId,
          "--force",
        ],
        import.meta.url,
      );

      // Command outputs error via fail
      expect(error?.message).toContain("Token not found or already revoked");
    });

    it("should handle authentication error (invalid API key)", async () => {
      const mockConfig = getMockConfigManager();
      const keyId = mockConfig.getKeyId()!;
      nock("https://rest.ably.io")
        .post(`/keys/${keyId}/revokeTokens`)
        .reply(401, { error: { message: "Unauthorized" } });

      const { error } = await runCommand(
        [
          "auth:revoke-token",
          mockToken,
          "--client-id",
          mockClientId,
          "--force",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/401|error|revoking/i);
    });

    it("should handle server error", async () => {
      const mockConfig = getMockConfigManager();
      const keyId = mockConfig.getKeyId()!;
      nock("https://rest.ably.io")
        .post(`/keys/${keyId}/revokeTokens`)
        .reply(500, { error: "Internal Server Error" });

      const { error } = await runCommand(
        [
          "auth:revoke-token",
          mockToken,
          "--client-id",
          mockClientId,
          "--force",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/500|error|revoking/i);
    });

    it("should require --force in JSON mode", async () => {
      const { stdout } = await runCommand(
        ["auth:revoke-token", mockToken, "--client-id", mockClientId, "--json"],
        import.meta.url,
      );

      const lines = parseNdjsonLines(stdout);
      const errorLine = lines.find((r) => r.type === "error");
      expect(errorLine).toBeDefined();
      expect(errorLine!.error.message).toContain(
        "The --force flag is required when using --json to confirm revocation",
      );
    });

    it("should cancel when user declines confirmation", async () => {
      const originalStdin = process.stdin;
      const { Readable } = await import("node:stream");

      function mockStdinAnswer(answer: string) {
        const readable = new Readable({ read() {} });
        Object.defineProperty(process, "stdin", {
          value: readable,
          writable: true,
          configurable: true,
        });
        queueMicrotask(() => {
          for (const chunk of [`${answer}\n`, null]) readable.push(chunk);
        });
      }

      try {
        mockStdinAnswer("n");

        const revokeNock = nock("https://rest.ably.io")
          .post(/\/keys\/.*\/revokeTokens/)
          .reply(200, {});

        const { stderr } = await runCommand(
          ["auth:revoke-token", mockToken, "--client-id", mockClientId],
          import.meta.url,
        );

        expect(stderr).toContain("Revocation cancelled");
        expect(revokeNock.isDone()).toBe(false);
      } finally {
        Object.defineProperty(process, "stdin", {
          value: originalStdin,
          writable: true,
          configurable: true,
        });
        nock.cleanAll();
      }
    });
  });

  standardFlagTests("auth:revoke-token", import.meta.url, [
    "--client-id",
    "--json",
    "--force",
  ]);
});
