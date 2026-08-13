import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import stripAnsi from "strip-ansi";
import {
  nockControl,
  controlApiCleanup,
} from "../../../helpers/control-api-test-helpers.js";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";
import { parseNdjsonLines } from "../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

/**
 * Select a local server profile, optionally with a control plane. Without one
 * there is no /me endpoint to verify the account against.
 */
function storeLocalAccount(controlUrl?: string) {
  const mock = getMockConfigManager();
  mock.clearAccounts();
  mock.storeLocalAccount("local", {
    accountName: "local",
    controlUrl,
    dataPlane: { endpoint: "localhost", port: 8081, tls: false },
  });
  mock.switchAccount("local");
  mock.setCurrentApp("localapp");
  mock.storeAppKey("localapp", "localapp.keyid:secret");
  return mock;
}

describe("accounts:current command", () => {
  const mockAccountId = "test-account-id";
  const mockAccountName = "Test Account";
  const mockUserEmail = "test@example.com";

  beforeEach(() => {
    controlApiCleanup();
  });

  afterEach(() => {
    controlApiCleanup();
  });

  describe("functionality", () => {
    it("should display account info from getMe() API call", async () => {
      const mock = getMockConfigManager();
      const accessToken = mock.getAccessToken()!;

      nockControl()
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

      nockControl()
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
      nockControl().get("/v1/me").replyWithError("Network error");

      const { stdout, stderr } = await runCommand(
        ["accounts:current"],
        import.meta.url,
      );

      const combined = stdout + stderr;
      expect(combined).toMatch(/Unable to verify|expired/i);
      expect(combined).toContain("cached");
    });

    it("should suggest re-login on failure", async () => {
      nockControl().get("/v1/me").replyWithError("Network error");

      const { stdout, stderr } = await runCommand(
        ["accounts:current"],
        import.meta.url,
      );

      const combined = stdout + stderr;
      expect(combined).toContain("ably accounts login");
    });
  });

  describe("local server accounts", () => {
    it("reports the stored server without claiming the token expired", async () => {
      storeLocalAccount();

      const { stdout, stderr } = await runCommand(
        ["accounts:current"],
        import.meta.url,
      );

      const combined = stripAnsi(stdout + stderr);
      expect(combined).toContain("Endpoint:");
      expect(combined).toContain("http://localhost:8081");
      expect(combined).not.toMatch(/expired|Unable to verify/i);
      expect(combined).not.toContain("aren't available for local server");
    });

    it("emits one success record carrying the server, and no error record", async () => {
      storeLocalAccount();

      const { stdout } = await runCommand(
        ["accounts:current", "--json"],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      expect(records.some((r) => r.type === "error")).toBe(false);

      const result = records.find((r) => r.type === "result")!;
      expect(result).toHaveProperty("success", true);
      const account = result.account as Record<string, unknown>;
      expect(account).toHaveProperty("alias", "local");
      expect(account).toHaveProperty("authMethod", "apiKey");
      expect(account.dataPlane).toEqual({
        endpoint: "localhost",
        port: 8081,
        tls: false,
        url: "http://localhost:8081",
      });
    });

    it("names the app once when there is no control plane to resolve a name", async () => {
      storeLocalAccount();

      const { stdout } = await runCommand(
        ["accounts:current"],
        import.meta.url,
      );

      expect(stripAnsi(stdout)).toContain("Current App: localapp");
      expect(stripAnsi(stdout)).not.toContain("localapp (localapp)");
    });

    it("suggests a local re-login when a local account's token has expired", async () => {
      storeLocalAccount("http://localhost:8082");
      nock("http://localhost:8082")
        .get("/v1/me")
        .replyWithError("Network error");

      const { stdout, stderr } = await runCommand(
        ["accounts:current"],
        import.meta.url,
      );

      const combined = stripAnsi(stdout + stderr);
      expect(combined).toContain("ably accounts login --local");
      expect(combined).toContain("--url http://localhost:8081");
      expect(combined).toContain("--control-url http://localhost:8082");
    });
  });

  describe("error handling", () => {
    it("should error when no account is selected", async () => {
      const mock = getMockConfigManager();
      mock.setCurrentAccountAlias(undefined);

      const { error } = await runCommand(["accounts:current"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/No account.*currently selected/i);
    });
  });

  standardHelpTests("accounts:current", import.meta.url);
  standardArgValidationTests("accounts:current", import.meta.url);
  standardFlagTests("accounts:current", import.meta.url, ["--json"]);

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
      expect(error?.message).toContain("not available in the web CLI");
    });
  });
});
