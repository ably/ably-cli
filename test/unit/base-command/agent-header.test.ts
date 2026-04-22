import { describe, it, expect, afterEach, vi } from "vitest";
import { Config } from "@oclif/core";
import { AblyBaseCommand } from "../../../src/base-command.js";
import { getCliVersion } from "../../../src/utils/version.js";

// Create a test command that extends AblyBaseCommand
class TestCommand extends AblyBaseCommand {
  async run(): Promise<void> {
    // No-op for testing
  }

  // Expose protected methods for testing
  public testGetClientOptions(
    flags: Record<string, unknown>,
  ): Record<string, unknown> {
    return this.getClientOptions(flags);
  }
}

describe("Agent Header Unit Tests", function () {
  afterEach(function () {
    delete process.env.ABLY_WEB_CLI_MODE;
  });

  describe("Ably SDK Agent Header", function () {
    it("should tag CLI traffic with the ably-cli agent by default", function () {
      const mockConfig = { runHook: vi.fn() } as unknown as Config;
      const command = new TestCommand([], mockConfig);

      const clientOptions = command.testGetClientOptions({
        "api-key": "test-key:secret",
      });

      expect(clientOptions.agents).toEqual({
        "ably-cli": getCliVersion(),
      });
    });

    it("should tag Web CLI traffic with the ably-web-cli agent", function () {
      process.env.ABLY_WEB_CLI_MODE = "true";
      const mockConfig = { runHook: vi.fn() } as unknown as Config;
      const command = new TestCommand([], mockConfig);

      const clientOptions = command.testGetClientOptions({
        "api-key": "test-key:secret",
      });

      expect(clientOptions.agents).toEqual({
        "ably-web-cli": getCliVersion(),
      });
    });
  });

  describe("Version Format", function () {
    it("should format agent header correctly", function () {
      const version = getCliVersion();
      const expectedAgentHeader = `ably-cli/${version}`;

      // Should match the format: ably-cli/x.y.z or ably-cli/x.y.z-alpha.n
      expect(expectedAgentHeader).toMatch(
        /^ably-cli\/\d+\.\d+\.\d+(-alpha\.\d+)?$/,
      );
    });
  });
});
