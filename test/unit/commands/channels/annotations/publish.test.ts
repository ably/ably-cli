import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("channels:annotations:publish command", () => {
  beforeEach(() => {
    getMockAblyRest();
  });

  standardHelpTests("channels:annotations:publish", import.meta.url);
  standardArgValidationTests("channels:annotations:publish", import.meta.url, {
    requiredArgs: ["test-channel", "serial-001", "reactions:flag.v1"],
  });
  standardFlagTests("channels:annotations:publish", import.meta.url, [
    "--json",
    "--name",
    "--count",
    "--data",
    "--encoding",
  ]);

  describe("functionality", () => {
    it("should publish an annotation successfully", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      const { stdout } = await runCommand(
        [
          "channels:annotations:publish",
          "test-channel",
          "serial-001",
          "reactions:flag.v1",
        ],
        import.meta.url,
      );

      expect(mock.channels.get).toHaveBeenCalledWith("test-channel");
      expect(channel.annotations.publish).toHaveBeenCalledExactlyOnceWith(
        "serial-001",
        {
          type: "reactions:flag.v1",
        },
      );
      expect(stdout).toContain("Annotation published");
    });

    it("should pass --name flag to annotation", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        [
          "channels:annotations:publish",
          "test-channel",
          "serial-001",
          "reactions:flag.v1",
          "--name",
          "thumbsup",
        ],
        import.meta.url,
      );

      expect(channel.annotations.publish).toHaveBeenCalledWith("serial-001", {
        type: "reactions:flag.v1",
        name: "thumbsup",
      });
    });

    it("should pass --count flag to annotation", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        [
          "channels:annotations:publish",
          "test-channel",
          "serial-001",
          "reactions:multiple.v1",
          "--name",
          "thumbsup",
          "--count",
          "3",
        ],
        import.meta.url,
      );

      expect(channel.annotations.publish).toHaveBeenCalledWith("serial-001", {
        type: "reactions:multiple.v1",
        name: "thumbsup",
        count: 3,
      });
    });

    it("should parse JSON --data flag", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        [
          "channels:annotations:publish",
          "test-channel",
          "serial-001",
          "reactions:flag.v1",
          "--data",
          '{"key":"value"}',
        ],
        import.meta.url,
      );

      expect(channel.annotations.publish).toHaveBeenCalledWith("serial-001", {
        type: "reactions:flag.v1",
        data: { key: "value" },
      });
    });

    it("should pass plain text --data flag", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        [
          "channels:annotations:publish",
          "test-channel",
          "serial-001",
          "reactions:flag.v1",
          "--data",
          "plain-text",
        ],
        import.meta.url,
      );

      expect(channel.annotations.publish).toHaveBeenCalledWith("serial-001", {
        type: "reactions:flag.v1",
        data: "plain-text",
      });
    });

    it("should pass --encoding flag to annotation", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        [
          "channels:annotations:publish",
          "test-channel",
          "serial-001",
          "reactions:flag.v1",
          "--encoding",
          "utf8",
        ],
        import.meta.url,
      );

      expect(channel.annotations.publish).toHaveBeenCalledWith("serial-001", {
        type: "reactions:flag.v1",
        encoding: "utf8",
      });
    });

    it("should output JSON when --json flag is used", async () => {
      const { stdout } = await runCommand(
        [
          "channels:annotations:publish",
          "test-channel",
          "serial-001",
          "reactions:flag.v1",
          "--json",
        ],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "channels:annotations:publish");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("channel", "test-channel");
      expect(result).toHaveProperty("serial", "serial-001");
    });
  });

  describe("error handling", () => {
    it("should handle API errors gracefully", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");
      channel.annotations.publish.mockRejectedValue(new Error("API error"));

      const { error } = await runCommand(
        [
          "channels:annotations:publish",
          "test-channel",
          "serial-001",
          "reactions:flag.v1",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("API error");
    });
  });
});
