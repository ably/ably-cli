import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";

describe("apps:switch command", () => {
  const mockAccountId = "test-account-id";
  const mockAppId = "app-123";
  const mockAppName = "Switched App";

  afterEach(() => {
    nock.cleanAll();
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["apps:switch", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Switch to a different Ably app");
      expect(stdout).toContain("USAGE");
    });

    it("should display examples in help", async () => {
      const { stdout } = await runCommand(
        ["apps:switch", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("EXAMPLES");
    });
  });

  describe("argument validation", () => {
    it("should accept optional appId argument", async () => {
      const { stdout } = await runCommand(
        ["apps:switch", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("APPID");
    });
  });

  describe("functionality", () => {
    it("should switch to an app when appId is provided", async () => {
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      nock("https://control.ably.net")
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, [
          {
            id: mockAppId,
            accountId: mockAccountId,
            name: mockAppName,
            status: "active",
            created: 1640995200000,
            modified: 1640995200000,
            tlsOnly: false,
          },
        ]);

      const { stdout } = await runCommand(
        ["apps:switch", mockAppId],
        import.meta.url,
      );

      expect(stdout).toContain("Switched to app");
      expect(stdout).toContain(mockAppName);
      expect(stdout).toContain(mockAppId);
    });

    it("should output JSON when --json flag is used", async () => {
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      nock("https://control.ably.net")
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, [
          {
            id: mockAppId,
            accountId: mockAccountId,
            name: mockAppName,
            status: "active",
            created: 1640995200000,
            modified: 1640995200000,
            tlsOnly: false,
          },
        ]);

      const { stdout } = await runCommand(
        ["apps:switch", mockAppId, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "apps:switch");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("appId", mockAppId);
      expect(result).toHaveProperty("appName", mockAppName);
    });
  });

  describe("flags", () => {
    it("should accept --json flag", async () => {
      const { stdout } = await runCommand(
        ["apps:switch", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--json");
    });

    it("should accept --pretty-json flag", async () => {
      const { stdout } = await runCommand(
        ["apps:switch", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--pretty-json");
    });
  });

  describe("error handling", () => {
    it("should handle app not found error", async () => {
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      nock("https://control.ably.net")
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, []);

      const { error } = await runCommand(
        ["apps:switch", "nonexistent-app"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });

    it("should handle 401 authentication error", async () => {
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["apps:switch", mockAppId],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error.message).toMatch(/401/);
    });

    it("should handle network errors", async () => {
      nock("https://control.ably.net")
        .get("/v1/me")
        .replyWithError("Network error");

      const { error } = await runCommand(
        ["apps:switch", mockAppId],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error.message).toMatch(/Network error/);
    });
  });
});
