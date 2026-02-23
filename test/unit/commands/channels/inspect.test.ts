import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";

describe("channels:inspect command", () => {
  const originalEnv = process.env.ABLY_WEB_CLI_MODE;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ABLY_WEB_CLI_MODE;
    } else {
      process.env.ABLY_WEB_CLI_MODE = originalEnv;
    }

    vi.clearAllMocks();
  });

  describe("normal CLI mode", () => {
    beforeEach(() => {
      delete process.env.ABLY_WEB_CLI_MODE;
    });

    it("should open browser with correct dashboard URL", async () => {
      const mockConfig = getMockConfigManager();
      const accountId = mockConfig.getCurrentAccount()!.accountId!;
      const appId = mockConfig.getCurrentAppId()!;

      const { stdout } = await runCommand(
        ["channels:inspect", "my-channel"],
        import.meta.url,
      );

      expect(stdout).toContain("Opening");
      expect(stdout).toContain("in your browser");
      expect(stdout).toContain(
        `https://ably.com/accounts/${accountId}/apps/${appId}/channels/my-channel`,
      );
    });

    it("should URL-encode special characters in channel name", async () => {
      const mockConfig = getMockConfigManager();
      const accountId = mockConfig.getCurrentAccount()!.accountId!;
      const appId = mockConfig.getCurrentAppId()!;

      const { stdout } = await runCommand(
        ["channels:inspect", "my-channel/foo#bar"],
        import.meta.url,
      );

      expect(stdout).toContain(
        `https://ably.com/accounts/${accountId}/apps/${appId}/channels/my-channel%2Ffoo%23bar`,
      );
    });

    it("should error when no account is configured", async () => {
      const mockConfig = getMockConfigManager();
      mockConfig.clearAccounts();

      const { error } = await runCommand(
        ["channels:inspect", "my-channel"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("No account configured");
      expect(error?.message).toContain("ably accounts login");
    });

    it("should error when no app is selected", async () => {
      const mockConfig = getMockConfigManager();
      mockConfig.setCurrentAppIdForAccount(undefined);

      const { error } = await runCommand(
        ["channels:inspect", "my-channel"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("No app selected");
      expect(error?.message).toContain("ably apps switch");
      expect(error?.message).toContain("--app");
    });

    it("should use --app flag over current app", async () => {
      const mockConfig = getMockConfigManager();
      const accountId = mockConfig.getCurrentAccount()!.accountId!;

      const { stdout } = await runCommand(
        ["channels:inspect", "my-channel", "--app", "custom-app-id"],
        import.meta.url,
      );

      expect(stdout).toContain(
        `https://ably.com/accounts/${accountId}/apps/custom-app-id/channels/my-channel`,
      );
    });

    it("should use --app flag when no current app is set", async () => {
      const mockConfig = getMockConfigManager();
      const accountId = mockConfig.getCurrentAccount()!.accountId!;
      mockConfig.setCurrentAppIdForAccount(undefined);

      const { stdout } = await runCommand(
        ["channels:inspect", "my-channel", "--app", "override-app"],
        import.meta.url,
      );

      expect(stdout).toContain(
        `https://ably.com/accounts/${accountId}/apps/override-app/channels/my-channel`,
      );
    });

    it("should use --dashboard-host flag to override base URL", async () => {
      const mockConfig = getMockConfigManager();
      const accountId = mockConfig.getCurrentAccount()!.accountId!;
      const appId = mockConfig.getCurrentAppId()!;

      const { stdout } = await runCommand(
        [
          "channels:inspect",
          "my-channel",
          "--dashboard-host",
          "https://staging.ably.com",
        ],
        import.meta.url,
      );

      expect(stdout).toContain(
        `https://staging.ably.com/accounts/${accountId}/apps/${appId}/channels/my-channel`,
      );
      expect(stdout).not.toContain("https://ably.com/accounts");
    });
  });

  describe("web CLI mode", () => {
    beforeEach(() => {
      process.env.ABLY_WEB_CLI_MODE = "true";
    });

    it("should display URL without opening browser", async () => {
      const mockConfig = getMockConfigManager();
      const accountId = mockConfig.getCurrentAccount()!.accountId!;
      const appId = mockConfig.getCurrentAppId()!;

      const { stdout } = await runCommand(
        ["channels:inspect", "my-channel"],
        import.meta.url,
      );

      expect(stdout).toContain("Visit");
      expect(stdout).toContain(
        `https://ably.com/accounts/${accountId}/apps/${appId}/channels/my-channel`,
      );
      expect(stdout).not.toContain("Opening");
      expect(stdout).not.toContain("in your browser");
    });
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["channels:inspect", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Open the Ably dashboard to inspect");
      expect(stdout).toContain("USAGE");
      expect(stdout).toContain("ARGUMENTS");
    });
  });
});
