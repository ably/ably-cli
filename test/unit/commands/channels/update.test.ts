import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

describe("channels:update command", () => {
  beforeEach(() => {
    getMockAblyRest();
  });

  standardHelpTests("channels:update", import.meta.url);
  standardArgValidationTests("channels:update", import.meta.url, {
    requiredArgs: ["test-channel", "serial-001"],
  });
  standardFlagTests("channels:update", import.meta.url, [
    "--json",
    "--name",
    "--encoding",
    "--description",
  ]);

  describe("functionality", () => {
    it("should update a message with JSON data", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      const { stdout } = await runCommand(
        ["channels:update", "test-channel", "serial-001", '{"data":"updated"}'],
        import.meta.url,
      );

      expect(mock.channels.get).toHaveBeenCalledWith("test-channel");
      expect(channel.updateMessage).toHaveBeenCalledOnce();
      expect(channel.updateMessage.mock.calls[0][0]).toEqual({
        serial: "serial-001",
        data: "updated",
      });
      expect(stdout).toContain("updated");
    });

    it("should update a message with plain text", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        ["channels:update", "test-channel", "serial-001", "PlainText"],
        import.meta.url,
      );

      expect(channel.updateMessage.mock.calls[0][0]).toEqual({
        serial: "serial-001",
        data: "PlainText",
      });
    });

    it("should apply --name flag", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        [
          "channels:update",
          "test-channel",
          "serial-001",
          '{"data":"hello"}',
          "--name",
          "my-event",
        ],
        import.meta.url,
      );

      expect(channel.updateMessage.mock.calls[0][0]).toHaveProperty(
        "name",
        "my-event",
      );
    });

    it("should apply --encoding flag", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        [
          "channels:update",
          "test-channel",
          "serial-001",
          '{"data":"hello"}',
          "--encoding",
          "utf8",
        ],
        import.meta.url,
      );

      expect(channel.updateMessage.mock.calls[0][0]).toHaveProperty(
        "encoding",
        "utf8",
      );
    });

    it("should pass description as operation metadata", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        [
          "channels:update",
          "test-channel",
          "serial-001",
          '{"data":"hello"}',
          "--description",
          "Fixed-typo",
        ],
        import.meta.url,
      );

      expect(channel.updateMessage.mock.calls[0][1]).toEqual({
        description: "Fixed-typo",
      });
    });

    it("should not pass operation when no description provided", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        ["channels:update", "test-channel", "serial-001", '{"data":"hello"}'],
        import.meta.url,
      );

      expect(channel.updateMessage.mock.calls[0][1]).toBeUndefined();
    });

    it("should output JSON when --json flag is used", async () => {
      const { stdout } = await runCommand(
        [
          "channels:update",
          "test-channel",
          "serial-001",
          '{"data":"hello"}',
          "--json",
        ],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "channels:update");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("message");
      expect(result.message).toHaveProperty("channel", "test-channel");
      expect(result.message).toHaveProperty("serial", "serial-001");
      expect(result.message).toHaveProperty(
        "versionSerial",
        "mock-version-serial-update",
      );
    });

    it("should handle null versionSerial (operation superseded)", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");
      channel.updateMessage.mockResolvedValue({ versionSerial: null });

      const { stdout } = await runCommand(
        ["channels:update", "test-channel", "serial-001", '{"data":"hello"}'],
        import.meta.url,
      );

      expect(stdout).toContain("superseded");
    });

    it("should display version serial in human-readable output", async () => {
      const { stdout } = await runCommand(
        ["channels:update", "test-channel", "serial-001", '{"data":"hello"}'],
        import.meta.url,
      );

      expect(stdout).toContain("mock-version-serial-update");
    });
  });

  describe("error handling", () => {
    it("should handle API errors gracefully", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");
      channel.updateMessage.mockRejectedValue(new Error("API error"));

      const { error } = await runCommand(
        ["channels:update", "test-channel", "serial-001", '{"data":"hello"}'],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("API error");
    });
  });
});
