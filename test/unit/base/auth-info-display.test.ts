import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Config } from "@oclif/core";
import nock from "nock";

import { AblyBaseCommand } from "../../../src/base-command.js";
import { BaseFlags } from "../../../src/types/cli.js";
import { ConfigManager } from "../../../src/services/config-manager.js";

// Test implementation of AblyBaseCommand for testing protected methods
class TestCommand extends AblyBaseCommand {
  // Implement the abstract run method required by oclif
  async run(): Promise<void> {
    // No-op for testing
  }

  // For direct testing of shouldHideAccountInfo
  public testShouldHideAccountInfo(): boolean {
    return this.shouldHideAccountInfo();
  }

  // For direct testing of showAuthInfoIfNeeded
  public async testShowAuthInfoIfNeeded(flags: BaseFlags = {}): Promise<void> {
    return this.showAuthInfoIfNeeded(flags);
  }

  // For direct testing of displayAuthInfo
  public async testDisplayAuthInfo(
    flags: BaseFlags = {},
    showAppInfo: boolean = true,
  ): Promise<void> {
    return this.displayAuthInfo(flags, showAppInfo);
  }

  // Expose other protected methods for testing
  public testShouldShowAuthInfo(): boolean {
    return this.shouldShowAuthInfo();
  }

  public testShouldOutputJson(flags: BaseFlags = {}): boolean {
    return this.shouldOutputJson(flags);
  }

  public testShouldSuppressOutput(flags: BaseFlags = {}): boolean {
    return this.shouldSuppressOutput(flags);
  }

  public async testDisplayDataPlaneInfo(flags: BaseFlags = {}): Promise<void> {
    return this.displayDataPlaneInfo(flags);
  }

  public async testDisplayControlPlaneInfo(
    flags: BaseFlags = {},
  ): Promise<void> {
    return this.displayControlPlaneInfo(flags);
  }
}

describe("Auth Info Display", function () {
  let command: TestCommand;
  let configManagerStub: {
    getCurrentAccount: ReturnType<typeof vi.fn>;
    getCurrentAppId: ReturnType<typeof vi.fn>;
    getAppName: ReturnType<typeof vi.fn>;
    getApiKey: ReturnType<typeof vi.fn>;
    getEndpoint: ReturnType<typeof vi.fn>;
    getKeyName: ReturnType<typeof vi.fn>;
    getAccessToken: ReturnType<typeof vi.fn>;
    getAppConfig: ReturnType<typeof vi.fn>;
    storeAppInfo: ReturnType<typeof vi.fn>;
    storeAppKey: ReturnType<typeof vi.fn>;
    getAuthMethod: ReturnType<typeof vi.fn>;
  };
  let logStub: ReturnType<typeof vi.fn>;
  let debugStub: ReturnType<typeof vi.fn>;

  beforeEach(function () {
    // Create mock config manager
    configManagerStub = {
      getCurrentAccount: vi.fn(),
      getCurrentAppId: vi.fn(),
      getAppName: vi.fn(),
      getApiKey: vi.fn(),
      getEndpoint: vi.fn(),
      getKeyName: vi.fn(),
      getAccessToken: vi.fn(),
      getAppConfig: vi.fn(),
      storeAppInfo: vi.fn(),
      storeAppKey: vi.fn(),
      getAuthMethod: vi.fn(),
    };

    // Initialize command with stubs
    command = new TestCommand([], {} as unknown as Config);

    // Replace the command's configManager with our stub
    (
      command as unknown as { configManager: Partial<ConfigManager> }
    ).configManager = configManagerStub;

    // Set up common stub behaviors - will be overridden in specific tests
    configManagerStub.getCurrentAccount.mockReturnValue({
      accountId: "test-account-id",
      accountName: "Test Account",
      accessToken: "test-token",
    });

    // Stub log and debug methods
    logStub = vi.spyOn(
      command as unknown as { log: (...args: unknown[]) => void },
      "log",
    );
    debugStub = vi.spyOn(
      command as unknown as { debug: (...args: unknown[]) => void },
      "debug",
    );

    // Make sure environment variables are clean
    delete process.env.ABLY_API_KEY;
    delete process.env.ABLY_TOKEN;
    delete process.env.ABLY_ACCESS_TOKEN;
  });

  afterEach(function () {
    vi.restoreAllMocks();
  });

  describe("shouldHideAccountInfo", function () {
    it("should return true when no account is configured", function () {
      configManagerStub.getCurrentAccount.mockReturnValue();
      expect(command.testShouldHideAccountInfo()).toBe(true);
    });

    it("should return true when ABLY_API_KEY environment variable is set", function () {
      process.env.ABLY_API_KEY = "app-id.key:secret";
      expect(command.testShouldHideAccountInfo()).toBe(true);
    });

    it("should return true when ABLY_TOKEN environment variable is set", function () {
      process.env.ABLY_TOKEN = "some-token";
      expect(command.testShouldHideAccountInfo()).toBe(true);
      delete process.env.ABLY_TOKEN;
    });

    it("should return true when ABLY_ACCESS_TOKEN environment variable is set", function () {
      process.env.ABLY_ACCESS_TOKEN = "some-access-token";
      expect(command.testShouldHideAccountInfo()).toBe(true);
    });

    it("should return false when account is configured and no auth overrides", function () {
      expect(command.testShouldHideAccountInfo()).toBe(false);
    });
  });

  describe("displayAuthInfo", function () {
    let shouldHideAccountInfoStub: ReturnType<typeof vi.fn>;

    beforeEach(function () {
      // Stub shouldHideAccountInfo
      shouldHideAccountInfoStub = vi.spyOn(
        command as unknown as { shouldHideAccountInfo: () => boolean },
        "shouldHideAccountInfo",
      );

      // Set up stubs for app info (already stubbed via configManagerStub in parent beforeEach)
      configManagerStub.getCurrentAppId.mockReturnValue("test-app-id");
      configManagerStub.getAppName.mockReturnValue("Test App");
      configManagerStub.getApiKey.mockReturnValue("test-app-id.key:secret");
      configManagerStub.getKeyName.mockReturnValue("Test Key");
    });

    it("should not include account info when shouldHideAccountInfo returns true", async function () {
      // Setup
      shouldHideAccountInfoStub.mockReturnValue(true);

      // Execute
      await command.testDisplayAuthInfo({});

      // Verify that the log output doesn't contain account info
      expect(logStub).toHaveBeenCalled();
      const outputCalls = logStub.mock.calls.map((call) => call[0]);
      const outputWithUsingPrefix = outputCalls.find(
        (output) => typeof output === "string" && output.includes("Using:"),
      );
      expect(outputWithUsingPrefix).not.toContain("Account=");
      expect(outputWithUsingPrefix).toContain("App=");
    });

    it("should include account info when shouldHideAccountInfo returns false", async function () {
      // Setup
      shouldHideAccountInfoStub.mockReturnValue(false);

      // Execute
      await command.testDisplayAuthInfo({});

      // Verify that the log output contains account info
      expect(logStub).toHaveBeenCalled();
      const outputCalls = logStub.mock.calls.map((call) => call[0]);
      const outputWithUsingPrefix = outputCalls.find(
        (output) => typeof output === "string" && output.includes("Using:"),
      );
      expect(outputWithUsingPrefix).toContain("Account=");
    });

    it("should not display anything when there are no parts to show", async function () {
      // Setup - hide account and don't show app info
      shouldHideAccountInfoStub.mockReturnValue(true);

      // Execute - setting showAppInfo to false means no app info is included
      await command.testDisplayAuthInfo({}, false);

      // Verify that nothing was logged
      expect(logStub).not.toHaveBeenCalled();
    });

    it("should display app and auth info when ABLY_TOKEN env var is set", async function () {
      // Setup
      shouldHideAccountInfoStub.mockReturnValue(true);
      process.env.ABLY_TOKEN = "test-token-value";

      // Execute
      await command.testDisplayAuthInfo({});

      // Cleanup
      delete process.env.ABLY_TOKEN;

      // Verify output includes token info but not account info
      expect(logStub).toHaveBeenCalled();
      const outputCalls = logStub.mock.calls.map((call) => call[0]);
      const outputWithUsingPrefix = outputCalls.find(
        (output) => typeof output === "string" && output.includes("Using:"),
      );
      expect(outputWithUsingPrefix).not.toContain("Account=");
      expect(outputWithUsingPrefix).toContain("App=");
      // The token is shown in a special format that may include ANSI color codes
      expect(outputWithUsingPrefix).toContain("Token");
    });

    it("should display app and key info when API key is provided", async function () {
      // Setup
      shouldHideAccountInfoStub.mockReturnValue(true);

      // Execute with API key
      await command.testDisplayAuthInfo({
        "api-key": "test-app-id.key:secret",
      });

      // Verify output includes key info but not account info
      expect(logStub).toHaveBeenCalled();
      const outputCalls = logStub.mock.calls.map((call) => call[0]);
      const outputWithUsingPrefix = outputCalls.find(
        (output) => typeof output === "string" && output.includes("Using:"),
      );
      expect(outputWithUsingPrefix).not.toContain("Account=");
      expect(outputWithUsingPrefix).toContain("App=");
      expect(outputWithUsingPrefix).toContain("Key=");
    });

    it("uses the stored account controlHost when fetching a missing app name", async function () {
      const customHost = "review-abc.herokuapp.com";
      const appId = "review-app-id";
      const accountId = "review-account-id";

      shouldHideAccountInfoStub.mockReturnValue(false);
      configManagerStub.getCurrentAccount.mockReturnValue({
        accountId,
        accountName: "Review Account",
        controlHost: customHost,
      });
      configManagerStub.getCurrentAppId.mockReturnValue(appId);
      // Reset the parent beforeEach's "Test App" defaults so we exercise the
      // missing-app-name branch (where ControlApi is consulted).
      configManagerStub.getAppName.mockReset();
      configManagerStub.getApiKey.mockReset();
      configManagerStub.getAppConfig.mockReset();
      configManagerStub.getAccessToken.mockReturnValue("review-access-token");

      const reviewScope = nock(`https://${customHost}`)
        .get("/api/v1/me")
        .reply(200, {
          account: { id: accountId, name: "Review Account" },
          user: { email: "review@example.com" },
        })
        .get(`/api/v1/accounts/${accountId}/apps`)
        .reply(200, [{ id: appId, name: "Review App", accountId }]);

      // Fail loud if anything reaches the production control plane.
      const productionTrap = nock("https://control.ably.net")
        .get(/.*/)
        .reply(404);

      try {
        await command.testDisplayAuthInfo({});

        const banner = logStub.mock.calls
          .map((call) => call[0])
          .find(
            (output) => typeof output === "string" && output.includes("Using:"),
          ) as string | undefined;

        expect(reviewScope.isDone()).toBe(true);
        expect(productionTrap.isDone()).toBe(false);
        expect(banner).toBeDefined();
        expect(banner).toContain("Review App");
        expect(banner).not.toContain("Unknown App");
        expect(configManagerStub.storeAppInfo).toHaveBeenCalledWith(appId, {
          appName: "Review App",
        });
      } finally {
        nock.cleanAll();
      }
    });
  });

  describe("showAuthInfoIfNeeded", function () {
    let displayDataPlaneInfoStub: ReturnType<typeof vi.fn>;
    let displayControlPlaneInfoStub: ReturnType<typeof vi.fn>;
    let shouldShowAuthInfoStub: ReturnType<typeof vi.fn>;
    let shouldOutputJsonStub: ReturnType<typeof vi.fn>;
    let shouldSuppressOutputStub: ReturnType<typeof vi.fn>;

    beforeEach(function () {
      // Create stubs
      displayDataPlaneInfoStub = vi.spyOn(
        command as unknown as {
          displayDataPlaneInfo: (flags: BaseFlags) => Promise<void>;
        },
        "displayDataPlaneInfo",
      );
      displayControlPlaneInfoStub = vi.spyOn(
        command as unknown as {
          displayControlPlaneInfo: (flags: BaseFlags) => Promise<void>;
        },
        "displayControlPlaneInfo",
      );
      shouldShowAuthInfoStub = vi.spyOn(
        command as unknown as { shouldShowAuthInfo: () => boolean },
        "shouldShowAuthInfo",
      );
      shouldOutputJsonStub = vi.spyOn(
        command as unknown as {
          shouldOutputJson: (flags: BaseFlags) => boolean;
        },
        "shouldOutputJson",
      );
      shouldSuppressOutputStub = vi.spyOn(
        command as unknown as {
          shouldSuppressOutput: (flags: BaseFlags) => boolean;
        },
        "shouldSuppressOutput",
      );

      // Default behavior - will be overridden in specific tests
      shouldShowAuthInfoStub.mockReturnValue(true);
      shouldOutputJsonStub.mockReturnValue(false);
      shouldSuppressOutputStub.mockReturnValue(false);

      // Default to non-web CLI mode
      (command as unknown as { isWebCliMode: boolean }).isWebCliMode = false;
    });

    it("should skip display when shouldShowAuthInfo returns false", async function () {
      shouldShowAuthInfoStub.mockReturnValue(false);

      await command.testShowAuthInfoIfNeeded({});

      expect(debugStub).toHaveBeenCalledOnce();
      expect(displayDataPlaneInfoStub).not.toHaveBeenCalled();
      expect(displayControlPlaneInfoStub).not.toHaveBeenCalled();
    });

    it("should skip display when quiet flag is true", async function () {
      await command.testShowAuthInfoIfNeeded({ quiet: true });

      expect(displayDataPlaneInfoStub).not.toHaveBeenCalled();
      expect(displayControlPlaneInfoStub).not.toHaveBeenCalled();
    });

    it("should skip display when in JSON output mode", async function () {
      shouldOutputJsonStub.mockReturnValue(true);

      await command.testShowAuthInfoIfNeeded({});

      expect(displayDataPlaneInfoStub).not.toHaveBeenCalled();
      expect(displayControlPlaneInfoStub).not.toHaveBeenCalled();
    });

    it("should skip display when token-only flag is true", async function () {
      await command.testShowAuthInfoIfNeeded({ "token-only": true });

      expect(displayDataPlaneInfoStub).not.toHaveBeenCalled();
      expect(displayControlPlaneInfoStub).not.toHaveBeenCalled();
    });

    it("should skip display when shouldSuppressOutput returns true", async function () {
      shouldSuppressOutputStub.mockReturnValue(true);

      await command.testShowAuthInfoIfNeeded({});

      expect(displayDataPlaneInfoStub).not.toHaveBeenCalled();
      expect(displayControlPlaneInfoStub).not.toHaveBeenCalled();
    });

    // Note: The logic for skipping display when API key or token is explicitly provided
    // has been moved to createAblyClientInternal to properly differentiate between
    // user-provided and configured credentials. These tests now verify that
    // showAuthInfoIfNeeded itself doesn't filter based on these flags.

    it("should skip display in Web CLI mode", async function () {
      (command as unknown as { isWebCliMode: boolean }).isWebCliMode = true;

      await command.testShowAuthInfoIfNeeded({});

      expect(debugStub).toHaveBeenCalledOnce();
      expect(displayDataPlaneInfoStub).not.toHaveBeenCalled();
      expect(displayControlPlaneInfoStub).not.toHaveBeenCalled();
    });

    it("should call displayDataPlaneInfo for apps: commands", async function () {
      Object.defineProperty(command, "id", { value: "apps:list" });

      await command.testShowAuthInfoIfNeeded({});

      expect(displayDataPlaneInfoStub).toHaveBeenCalledOnce();
      expect(displayControlPlaneInfoStub).not.toHaveBeenCalled();
    });

    it("should call displayDataPlaneInfo for channels: commands", async function () {
      Object.defineProperty(command, "id", { value: "channels:publish" });

      await command.testShowAuthInfoIfNeeded({});

      expect(displayDataPlaneInfoStub).toHaveBeenCalledOnce();
      expect(displayControlPlaneInfoStub).not.toHaveBeenCalled();
    });

    it("should call displayDataPlaneInfo for auth: commands", async function () {
      Object.defineProperty(command, "id", { value: "auth:issue-ably-token" });

      await command.testShowAuthInfoIfNeeded({});

      expect(displayDataPlaneInfoStub).toHaveBeenCalledOnce();
      expect(displayControlPlaneInfoStub).not.toHaveBeenCalled();
    });

    it("should call displayDataPlaneInfo for rooms: commands", async function () {
      Object.defineProperty(command, "id", { value: "rooms:list" });

      await command.testShowAuthInfoIfNeeded({});

      expect(displayDataPlaneInfoStub).toHaveBeenCalledOnce();
      expect(displayControlPlaneInfoStub).not.toHaveBeenCalled();
    });

    it("should call displayControlPlaneInfo for accounts: commands", async function () {
      Object.defineProperty(command, "id", { value: "accounts:list" });

      await command.testShowAuthInfoIfNeeded({});

      expect(displayDataPlaneInfoStub).not.toHaveBeenCalled();
      expect(displayControlPlaneInfoStub).toHaveBeenCalledOnce();
    });

    it("should call displayControlPlaneInfo for integrations: commands", async function () {
      Object.defineProperty(command, "id", { value: "integrations:list" });

      await command.testShowAuthInfoIfNeeded({});

      expect(displayDataPlaneInfoStub).not.toHaveBeenCalled();
      expect(displayControlPlaneInfoStub).toHaveBeenCalledOnce();
    });

    it("should not call any display method for other commands", async function () {
      Object.defineProperty(command, "id", { value: "help" });

      await command.testShowAuthInfoIfNeeded({});

      expect(displayDataPlaneInfoStub).not.toHaveBeenCalled();
      expect(displayControlPlaneInfoStub).not.toHaveBeenCalled();
    });

    it("should pass flags to display methods", async function () {
      Object.defineProperty(command, "id", { value: "apps:list" });
      const flags = { app: "test-app", verbose: true };

      await command.testShowAuthInfoIfNeeded(flags);

      expect(displayDataPlaneInfoStub).toHaveBeenCalledWith(flags);
    });
  });
});
