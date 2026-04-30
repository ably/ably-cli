import { Readable } from "node:stream";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";
import {
  standardHelpTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";
import { parseNdjsonLines } from "../../../helpers/ndjson.js";

describe("auth:revoke-token command", () => {
  const mockClientId = "test-client-id";
  const mockRevocationKey = "group1";

  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  standardHelpTests("auth:revoke-token", import.meta.url);

  describe("flag validation", () => {
    it("should fail when neither --client-id nor --revocation-key is provided", async () => {
      const { error } = await runCommand(
        ["auth:revoke-token", "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain(
        "Either --client-id or --revocation-key must be provided",
      );
    });

    it("should fail when both --client-id and --revocation-key are provided", async () => {
      const { error } = await runCommand(
        [
          "auth:revoke-token",
          "--client-id",
          mockClientId,
          "--revocation-key",
          mockRevocationKey,
          "--force",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(
        /cannot also be provided when using.*--client-id|cannot also be provided when using.*--revocation-key/i,
      );
    });
  });

  describe("token revocation by client ID", () => {
    it("should successfully revoke tokens for a client ID", async () => {
      const mockConfig = getMockConfigManager();
      const keyId = mockConfig.getKeyId()!;
      nock("https://rest.ably.io")
        .post(`/keys/${keyId}/revokeTokens`, {
          targets: [`clientId:${mockClientId}`],
        })
        .reply(200, {});

      const { stderr } = await runCommand(
        ["auth:revoke-token", "--client-id", mockClientId, "--force"],
        import.meta.url,
      );

      expect(stderr).toContain("have been revoked");
    });

    it("should include allowReauthMargin when --allow-reauth-margin is provided", async () => {
      const mockConfig = getMockConfigManager();
      const keyId = mockConfig.getKeyId()!;
      nock("https://rest.ably.io")
        .post(`/keys/${keyId}/revokeTokens`, {
          targets: [`clientId:${mockClientId}`],
          allowReauthMargin: true,
        })
        .reply(200, {});

      const { stderr } = await runCommand(
        [
          "auth:revoke-token",
          "--client-id",
          mockClientId,
          "--allow-reauth-margin",
          "--force",
        ],
        import.meta.url,
      );

      expect(stderr).toContain("have been revoked");
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
        ["auth:revoke-token", "--client-id", mockClientId, "--json", "--force"],
        import.meta.url,
      );

      const result = parseNdjsonLines(stdout).find((r) => r.type === "result")!;
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("revocation");
      expect(result.revocation).toHaveProperty(
        "message",
        `Tokens matching client id ${mockClientId} have been revoked.`,
      );
      expect(result.revocation).toHaveProperty(
        "target",
        `clientId:${mockClientId}`,
      );
      expect(result.revocation).toHaveProperty("response");
    });
  });

  describe("token revocation by revocation key", () => {
    it("should successfully revoke tokens for a revocation key", async () => {
      const mockConfig = getMockConfigManager();
      const keyId = mockConfig.getKeyId()!;
      nock("https://rest.ably.io")
        .post(`/keys/${keyId}/revokeTokens`, {
          targets: [`revocationKey:${mockRevocationKey}`],
        })
        .reply(200, {});

      const { stderr } = await runCommand(
        ["auth:revoke-token", "--revocation-key", mockRevocationKey, "--force"],
        import.meta.url,
      );

      expect(stderr).toContain("have been revoked");
    });
  });

  describe("error handling", () => {
    it("should handle token not found error", async () => {
      const mockConfig = getMockConfigManager();
      const keyId = mockConfig.getKeyId()!;
      nock("https://rest.ably.io")
        .post(`/keys/${keyId}/revokeTokens`)
        .reply(404, "token_not_found");

      const { error } = await runCommand(
        ["auth:revoke-token", "--client-id", mockClientId, "--force"],
        import.meta.url,
      );

      expect(error?.message).toContain(
        "No matching tokens found or already revoked",
      );
    });

    it("should handle authentication error (invalid API key)", async () => {
      const mockConfig = getMockConfigManager();
      const keyId = mockConfig.getKeyId()!;
      nock("https://rest.ably.io")
        .post(`/keys/${keyId}/revokeTokens`)
        .reply(401, { error: { message: "Unauthorized" } });

      const { error } = await runCommand(
        ["auth:revoke-token", "--client-id", mockClientId, "--force"],
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
        ["auth:revoke-token", "--client-id", mockClientId, "--force"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/500|error|revoking/i);
    });
  });

  describe("confirmation prompt", () => {
    const originalStdin = process.stdin;

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

    afterEach(() => {
      Object.defineProperty(process, "stdin", {
        value: originalStdin,
        writable: true,
        configurable: true,
      });
    });

    it("should require --force in JSON mode", async () => {
      const { stdout } = await runCommand(
        ["auth:revoke-token", "--client-id", mockClientId, "--json"],
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
      mockStdinAnswer("n");

      const revokeNock = nock("https://rest.ably.io")
        .post(/\/keys\/.*\/revokeTokens/)
        .reply(200, {});

      const { stderr } = await runCommand(
        ["auth:revoke-token", "--client-id", mockClientId],
        import.meta.url,
      );

      expect(stderr).toContain("Revocation cancelled");
      expect(revokeNock.isDone()).toBe(false);
    });
  });

  standardFlagTests("auth:revoke-token", import.meta.url, [
    "--client-id",
    "--revocation-key",
    "--allow-reauth-margin",
    "--json",
    "--force",
  ]);
});
