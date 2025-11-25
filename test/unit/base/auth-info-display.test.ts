import { describe, it, expect, beforeEach, vi } from "vitest";

import { AblyBaseCommand } from "../../../src/base-command.js";

// Test implementation of AblyBaseCommand for testing protected methods
class TestCommand extends AblyBaseCommand {
  // Implement the abstract run method required by oclif
  async run(): Promise<void> {
    // No-op for testing
  }

  // For direct testing of shouldHideAccountInfo
  public testShouldHideAccountInfo(flags: any = {}): boolean {
    return this.shouldHideAccountInfo(flags);
  }

  // For direct testing of showAuthInfoIfNeeded
  public async testShowAuthInfoIfNeeded(flags: any = {}): Promise<void> {
    return this.showAuthInfoIfNeeded(flags);
  }

  // For direct testing of displayAuthInfo
  public async testDisplayAuthInfo(
    flags: any = {},
    showAppInfo: boolean = true,
  ): Promise<void> {
    return this.displayAuthInfo(flags, showAppInfo);
  }

  // Expose other protected methods for testing
  public testShouldShowAuthInfo(): boolean {
    return this.shouldShowAuthInfo();
  }

  public testShouldOutputJson(flags: any = {}): boolean {
    return this.shouldOutputJson(flags);
  }

  public testShouldSuppressOutput(flags: any = {}): boolean {
    return this.shouldSuppressOutput(flags);
  }

  public async testDisplayDataPlaneInfo(flags: any = {}): Promise<void> {
    return this.displayDataPlaneInfo(flags);
  }

  public async testDisplayControlPlaneInfo(flags: any = {}): Promise<void> {
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
    getKeyName: ReturnType<typeof vi.fn>;
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
      getKeyName: vi.fn(),
    };

    // Initialize command with stubs
    command = new TestCommand([], {} as any);

    // Replace the command's configManager with our stub
    (command as any).configManager = configManagerStub;

    // Set up common stub behaviors - will be overridden in specific tests
    configManagerStub.getCurrentAccount.mockReturnValue({
      accountId: "test-account-id",
      accountName: "Test Account",
      accessToken: "test-token",
    });

    // Stub log and debug methods
    logStub = vi.spyOn(command as any, "log");
    debugStub = vi.spyOn(command as any, "debug");

    // Make sure environment variables are clean
    delete process.env.ABLY_API_KEY;
    delete process.env.ABLY_ACCESS_TOKEN;
  });

  describe("shouldHideAccountInfo", function () {
    it("should return true when no account is configured", function () {
      configManagerStub.getCurrentAccount.mockReturnValue(undefined as any);
      expect(command.testShouldHideAccountInfo({})).toBe(true);
    });

    it("should return true when API key is provided explicitly", function () {
      expect(
        command.testShouldHideAccountInfo({ "api-key": "app-id.key:secret" }),
      ).toBe(true);
    });

    it("should return true when token is provided explicitly", function () {
      expect(command.testShouldHideAccountInfo({ token: "some-token" })).toBe(
        true,
      );
    });

    it("should return true when access token is provided explicitly", function () {
      expect(
        command.testShouldHideAccountInfo({
          "access-token": "some-access-token",
        }),
      ).toBe(true);
    });

    it("should return true when ABLY_API_KEY environment variable is set", function () {
      process.env.ABLY_API_KEY = "app-id.key:secret";
      expect(command.testShouldHideAccountInfo({})).toBe(true);
    });

    it("should return true when ABLY_ACCESS_TOKEN environment variable is set", function () {
      process.env.ABLY_ACCESS_TOKEN = "some-access-token";
      expect(command.testShouldHideAccountInfo({})).toBe(true);
    });

    it("should return false when account is configured and no auth overrides", function () {
      expect(command.testShouldHideAccountInfo({})).toBe(false);
    });
  });

  describe("displayAuthInfo", function () {
    let shouldHideAccountInfoStub: ReturnType<typeof vi.fn>;

    beforeEach(function () {
      // Stub shouldHideAccountInfo
      shouldHideAccountInfoStub = vi.spyOn(
        command as any,
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

    it("should display app and auth info when token is provided", async function () {
      // Setup
      shouldHideAccountInfoStub.mockReturnValue(true);

      // Execute with token - also need to ensure the command has a token that's reflected in output
      const flags = { token: "test-token" };
      await command.testDisplayAuthInfo(flags);

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
        command as any,
        "displayDataPlaneInfo",
      );
      displayControlPlaneInfoStub = vi.spyOn(
        command as any,
        "displayControlPlaneInfo",
      );
      shouldShowAuthInfoStub = vi.spyOn(command as any, "shouldShowAuthInfo");
      shouldOutputJsonStub = vi.spyOn(command as any, "shouldOutputJson");
      shouldSuppressOutputStub = vi.spyOn(
        command as any,
        "shouldSuppressOutput",
      );

      // Default behavior - will be overridden in specific tests
      shouldShowAuthInfoStub.mockReturnValue(true);
      shouldOutputJsonStub.mockReturnValue(false);
      shouldSuppressOutputStub.mockReturnValue(false);

      // Default to non-web CLI mode
      (command as any).isWebCliMode = false;
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
      (command as any).isWebCliMode = true;

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
