import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import stripAnsi from "strip-ansi";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";
import { parseJsonOutput } from "../../../helpers/ndjson.js";

describe("accounts:list command", () => {
  beforeEach(() => {
    // Config is auto-reset by setup.ts
  });

  describe("functionality", () => {
    it("should show message when no accounts configured", async () => {
      const mock = getMockConfigManager();
      mock.clearAccounts();

      const { error } = await runCommand(["accounts:list"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toContain("No accounts configured");
      expect(error?.message).toContain("ably accounts login");
    });

    it("should output JSON error when no accounts with --json", async () => {
      const mock = getMockConfigManager();
      mock.clearAccounts();

      const { stdout } = await runCommand(
        ["accounts:list", "--json"],
        import.meta.url,
      );

      const result = parseJsonOutput(stdout);
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("accounts");
      expect(result.accounts).toEqual([]);
    });
  });

  describe("with accounts", () => {
    it("should display accounts with current marker", async () => {
      const { stdout } = await runCommand(["accounts:list"], import.meta.url);

      expect(stdout).toContain("Found");
      expect(stdout).toContain("accounts:");
      expect(stdout).toContain("(current)");
    });

    it("should show app count per account", async () => {
      const { stdout } = await runCommand(["accounts:list"], import.meta.url);

      expect(stdout).toContain("Apps configured:");
    });

    it("should output JSON with isCurrent flag", async () => {
      const { stdout } = await runCommand(
        ["accounts:list", "--json"],
        import.meta.url,
      );

      const result = parseJsonOutput(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("accounts");
      expect(result.accounts.length).toBeGreaterThan(0);

      const currentAccount = result.accounts.find(
        (a: { isCurrent: boolean }) => a.isCurrent,
      );
      expect(currentAccount).toBeDefined();
      expect(currentAccount.isCurrent).toBe(true);
      expect(currentAccount).toHaveProperty("alias");
      expect(currentAccount).toHaveProperty("appsConfigured");
    });
  });

  describe("local server accounts", () => {
    beforeEach(() => {
      const mock = getMockConfigManager();
      mock.clearAccounts();
      mock.storeLocalAccount("local", {
        accountName: "local",
        dataPlane: { endpoint: "localhost", port: 8081, tls: false },
      });
      mock.storeLocalAccount("other", {
        accountName: "other",
        controlUrl: "http://localhost:8092",
        dataPlane: { endpoint: "localhost", port: 8091, tls: false },
      });
      mock.switchAccount("local");
    });

    it("shows the server URL, which is what tells two local profiles apart", async () => {
      const { stdout } = await runCommand(["accounts:list"], import.meta.url);

      const output = stripAnsi(stdout);
      expect(output).toContain("Endpoint: http://localhost:8081");
      expect(output).toContain("Endpoint: http://localhost:8091");
      expect(output).toContain("Control plane: http://localhost:8092");
    });

    it("carries the routing in JSON and omits the empty account ID and user", async () => {
      const { stdout } = await runCommand(
        ["accounts:list", "--json"],
        import.meta.url,
      );

      const result = parseJsonOutput(stdout);
      const local = result.accounts.find(
        (a: { alias: string }) => a.alias === "local",
      );
      expect(local.dataPlane).toEqual({
        endpoint: "localhost",
        port: 8081,
        tls: false,
        url: "http://localhost:8081",
      });
      expect(local).toHaveProperty("authMethod", "apiKey");
      expect(local).not.toHaveProperty("id");
      expect(local).not.toHaveProperty("user");

      const other = result.accounts.find(
        (a: { alias: string }) => a.alias === "other",
      );
      expect(other).toHaveProperty("controlUrl", "http://localhost:8092");
    });
  });

  standardHelpTests("accounts:list", import.meta.url);
  standardArgValidationTests("accounts:list", import.meta.url);
  standardFlagTests("accounts:list", import.meta.url, ["--json"]);

  describe("error handling", () => {
    it("should handle errors gracefully", async () => {
      const mock = getMockConfigManager();
      mock.clearAccounts();

      const { error } = await runCommand(["accounts:list"], import.meta.url);
      expect(error).toBeDefined();
    });
  });
});
