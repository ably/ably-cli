import { describe, it, expect, beforeEach, vi } from "vitest";
import { Config } from "@oclif/core";
import { AblyBaseCommand } from "../../../src/base-command.js";
import { getCliVersion } from "../../../src/utils/version.js";

// Create a test command that extends AblyBaseCommand
class TestCommand extends AblyBaseCommand {
  async run(): Promise<void> {
    // No-op for testing
  }

  // Expose protected methods for testing
  public testGetClientOptions(flags: any): any {
    return this.getClientOptions(flags);
  }
}

describe("Agent Header Unit Tests", function () {
  beforeEach(function () {});

  describe("Ably SDK Agent Header", function () {
    it("should include agent header in client options", function () {
      const mockConfig = { runHook: vi.fn() } as unknown as Config;
      const command = new TestCommand([], mockConfig);

      const flags = {
        "api-key": "test-key:secret",
      };

      const clientOptions = command.testGetClientOptions(flags);

      expect(clientOptions.agents).toBeDefined();
      expect(clientOptions.agents).toEqual({
        "ably-cli": getCliVersion(),
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
