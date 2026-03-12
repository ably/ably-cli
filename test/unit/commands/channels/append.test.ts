import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

describe("channels:append command", () => {
  beforeEach(() => {
    getMockAblyRest();
  });

  standardHelpTests("channels:append", import.meta.url);
  standardArgValidationTests("channels:append", import.meta.url, {
    requiredArgs: ["test-channel", "serial-001"],
  });
  standardFlagTests("channels:append", import.meta.url, [
    "--json",
    "--name",
    "--encoding",
    "--description",
  ]);

  describe("functionality", () => {
    it("should append to a message with JSON data", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      const { stdout } = await runCommand(
        [
          "channels:append",
          "test-channel",
          "serial-001",
          '{"data":"appended"}',
        ],
        import.meta.url,
      );

      expect(mock.channels.get).toHaveBeenCalledWith("test-channel");
      expect(channel.appendMessage).toHaveBeenCalledOnce();
      expect(channel.appendMessage.mock.calls[0][0]).toEqual({
        serial: "serial-001",
        data: "appended",
      });
      expect(stdout).toContain("Appended");
    });

    it("should append with plain text", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        ["channels:append", "test-channel", "serial-001", "PlainText"],
        import.meta.url,
      );

      expect(channel.appendMessage.mock.calls[0][0]).toEqual({
        serial: "serial-001",
        data: "PlainText",
      });
    });

    it("should apply --name flag", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        [
          "channels:append",
          "test-channel",
          "serial-001",
          '{"data":"hello"}',
          "--name",
          "my-event",
        ],
        import.meta.url,
      );

      expect(channel.appendMessage.mock.calls[0][0]).toHaveProperty(
        "name",
        "my-event",
      );
    });

    it("should apply --encoding flag", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        [
          "channels:append",
          "test-channel",
          "serial-001",
          '{"data":"hello"}',
          "--encoding",
          "utf8",
        ],
        import.meta.url,
      );

      expect(channel.appendMessage.mock.calls[0][0]).toHaveProperty(
        "encoding",
        "utf8",
      );
    });

    it("should pass description as operation metadata", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        [
          "channels:append",
          "test-channel",
          "serial-001",
          '{"data":"hello"}',
          "--description",
          "Added-context",
        ],
        import.meta.url,
      );

      expect(channel.appendMessage.mock.calls[0][1]).toEqual({
        description: "Added-context",
      });
    });

    it("should preserve extras from message data", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        [
          "channels:append",
          "test-channel",
          "serial-001",
          '{"data":"hello","extras":{"push":{"notification":{"title":"Test","body":"Push"}}}}',
        ],
        import.meta.url,
      );

      const sentMessage = channel.appendMessage.mock.calls[0][0];
      expect(sentMessage).toHaveProperty("data", "hello");
      expect(sentMessage).toHaveProperty("extras");
      expect(sentMessage.extras).toEqual({
        push: { notification: { title: "Test", body: "Push" } },
      });
    });

    it("should not pass operation when no description provided", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        ["channels:append", "test-channel", "serial-001", '{"data":"hello"}'],
        import.meta.url,
      );

      expect(channel.appendMessage.mock.calls[0][1]).toBeUndefined();
    });

    it("should output JSON when --json flag is used", async () => {
      const { stdout } = await runCommand(
        [
          "channels:append",
          "test-channel",
          "serial-001",
          '{"data":"hello"}',
          "--json",
        ],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "channels:append");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("channel", "test-channel");
      expect(result).toHaveProperty("serial", "serial-001");
      expect(result).toHaveProperty(
        "versionSerial",
        "mock-version-serial-append",
      );
    });

    it("should display version serial in human-readable output", async () => {
      const { stdout } = await runCommand(
        ["channels:append", "test-channel", "serial-001", '{"data":"hello"}'],
        import.meta.url,
      );

      expect(stdout).toContain("mock-version-serial-append");
    });
  });

  describe("error handling", () => {
    it("should handle API errors gracefully", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");
      channel.appendMessage.mockRejectedValue(new Error("API error"));

      const { error } = await runCommand(
        ["channels:append", "test-channel", "serial-001", '{"data":"hello"}'],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("API error");
    });
  });
});
