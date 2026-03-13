import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

describe("channels:delete command", () => {
  beforeEach(() => {
    getMockAblyRest();
  });

  standardHelpTests("channels:delete", import.meta.url);
  standardArgValidationTests("channels:delete", import.meta.url, {
    requiredArgs: ["test-channel", "serial-001"],
  });
  standardFlagTests("channels:delete", import.meta.url, [
    "--json",
    "--description",
  ]);

  describe("functionality", () => {
    it("should delete a message successfully", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      const { stdout } = await runCommand(
        ["channels:delete", "test-channel", "serial-001"],
        import.meta.url,
      );

      expect(mock.channels.get).toHaveBeenCalledWith("test-channel");
      expect(channel.deleteMessage).toHaveBeenCalledOnce();
      expect(channel.deleteMessage.mock.calls[0][0]).toEqual({
        serial: "serial-001",
      });
      expect(stdout).toContain("deleted");
    });

    it("should pass description as operation metadata", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        [
          "channels:delete",
          "test-channel",
          "serial-001",
          "--description",
          "Removed-by-admin",
        ],
        import.meta.url,
      );

      expect(channel.deleteMessage).toHaveBeenCalledOnce();
      expect(channel.deleteMessage.mock.calls[0][1]).toEqual({
        description: "Removed-by-admin",
      });
    });

    it("should not pass operation when no description provided", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        ["channels:delete", "test-channel", "serial-001"],
        import.meta.url,
      );

      expect(channel.deleteMessage.mock.calls[0][1]).toBeUndefined();
    });

    it("should output JSON when --json flag is used", async () => {
      const { stdout } = await runCommand(
        ["channels:delete", "test-channel", "serial-001", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "channels:delete");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("channel", "test-channel");
      expect(result).toHaveProperty("serial", "serial-001");
      expect(result).toHaveProperty(
        "versionSerial",
        "mock-version-serial-delete",
      );
    });

    it("should handle null versionSerial (operation superseded)", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");
      channel.deleteMessage.mockResolvedValue({ versionSerial: null });

      const { stdout } = await runCommand(
        ["channels:delete", "test-channel", "serial-001"],
        import.meta.url,
      );

      expect(stdout).toContain("superseded");
    });

    it("should display version serial in human-readable output", async () => {
      const { stdout } = await runCommand(
        ["channels:delete", "test-channel", "serial-001"],
        import.meta.url,
      );

      expect(stdout).toContain("mock-version-serial-delete");
    });
  });

  describe("error handling", () => {
    it("should handle API errors gracefully", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");
      channel.deleteMessage.mockRejectedValue(new Error("API error"));

      const { error } = await runCommand(
        ["channels:delete", "test-channel", "serial-001"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("API error");
    });
  });
});
