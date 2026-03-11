import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";

describe("accounts:current command", () => {
  const mockAccountId = "test-account-id";
  const mockAccountName = "Test Account";
  const mockUserEmail = "test@example.com";

  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe("functionality", () => {
    it("should display account info from getMe() API call", async () => {
      const mock = getMockConfigManager();
      const accessToken = mock.getAccessToken()!;

      nock("https://control.ably.net")
        .get("/v1/me")
        .matchHeader("authorization", `Bearer ${accessToken}`)
        .reply(200, {
          account: { id: mockAccountId, name: mockAccountName },
          user: { email: mockUserEmail },
        });

      const { stdout } = await runCommand(
        ["accounts:current"],
        import.meta.url,
      );

      expect(stdout).toContain("Account:");
      expect(stdout).toContain(mockAccountName);
      expect(stdout).toContain(mockAccountId);
      expect(stdout).toContain("User:");
      expect(stdout).toContain(mockUserEmail);
    });

    it("should display current app and key info", async () => {
      const mock = getMockConfigManager();
      const accessToken = mock.getAccessToken()!;

      nock("https://control.ably.net")
        .get("/v1/me")
        .matchHeader("authorization", `Bearer ${accessToken}`)
        .reply(200, {
          account: { id: mockAccountId, name: mockAccountName },
          user: { email: mockUserEmail },
        });

      const { stdout } = await runCommand(
        ["accounts:current"],
        import.meta.url,
      );

      // The mock config has an app and key configured
      expect(stdout).toContain("Current App:");
      expect(stdout).toContain("Current API Key:");
    });
  });

  describe("fallback behavior", () => {
    it("should show cached info when API fails", async () => {
      nock("https://control.ably.net")
        .get("/v1/me")
        .replyWithError("Network error");

      const { stdout, stderr } = await runCommand(
        ["accounts:current"],
        import.meta.url,
      );

      const combined = stdout + stderr;
      expect(combined).toMatch(/Unable to verify|expired/i);
      expect(combined).toContain("cached");
    });

    it("should suggest re-login on failure", async () => {
      nock("https://control.ably.net")
        .get("/v1/me")
        .replyWithError("Network error");

      const { stdout, stderr } = await runCommand(
        ["accounts:current"],
        import.meta.url,
      );

      const combined = stdout + stderr;
      expect(combined).toContain("ably accounts login");
    });
  });

  describe("error handling", () => {
    it("should error when no account is selected", async () => {
      const mock = getMockConfigManager();
      mock.setCurrentAccountAlias(undefined);

      const { error } = await runCommand(["accounts:current"], import.meta.url);

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/No account.*currently selected/i);
    });
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["accounts:current", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("USAGE");
    });
  });

  describe("argument validation", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["accounts:current", "--unknown-flag-xyz"],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("flags", () => {
    it("should accept --json flag", async () => {
      const { stdout } = await runCommand(
        ["accounts:current", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("--json");
    });
  });

  describe("web-cli mode restriction", () => {
    let originalWebCliMode: string | undefined;

    beforeEach(() => {
      originalWebCliMode = process.env.ABLY_WEB_CLI_MODE;
    });

    afterEach(() => {
      if (originalWebCliMode === undefined) {
        delete process.env.ABLY_WEB_CLI_MODE;
      } else {
        process.env.ABLY_WEB_CLI_MODE = originalWebCliMode;
      }
    });

    it("should be restricted in web-cli mode", async () => {
      process.env.ABLY_WEB_CLI_MODE = "true";

      const { error } = await runCommand(["accounts:current"], import.meta.url);

      expect(error).toBeDefined();
      expect(error!.message).toContain("not available in the web CLI");
    });
  });
});
