import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../../helpers/mock-ably-rest.js";
import { captureJsonLogs } from "../../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("channels:annotations:get command", () => {
  beforeEach(() => {
    getMockAblyRest();
  });

  standardHelpTests("channels:annotations:get", import.meta.url);
  standardArgValidationTests("channels:annotations:get", import.meta.url, {
    requiredArgs: ["test-channel", "serial-001"],
  });
  standardFlagTests("channels:annotations:get", import.meta.url, [
    "--json",
    "--limit",
  ]);

  describe("functionality", () => {
    it("should get annotations for a message", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");
      channel.annotations.get.mockResolvedValue({
        items: [
          {
            type: "reactions:flag.v1",
            name: "thumbsup",
            clientId: "user-1",
            timestamp: 1700000000000,
          },
        ],
      });

      const { stdout } = await runCommand(
        ["channels:annotations:get", "test-channel", "serial-001"],
        import.meta.url,
      );

      expect(mock.channels.get).toHaveBeenCalledWith("test-channel");
      expect(channel.annotations.get).toHaveBeenCalledExactlyOnceWith(
        "serial-001",
        {
          limit: 50,
        },
      );
      expect(stdout).toContain("reactions:flag.v1");
      expect(stdout).toContain("thumbsup");
    });

    it("should display empty message when no annotations found", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");
      channel.annotations.get.mockResolvedValue({ items: [] });

      const { stdout } = await runCommand(
        ["channels:annotations:get", "test-channel", "serial-001"],
        import.meta.url,
      );

      expect(stdout).toContain("No annotations found");
    });

    it("should pass --limit flag", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        [
          "channels:annotations:get",
          "test-channel",
          "serial-001",
          "--limit",
          "100",
        ],
        import.meta.url,
      );

      expect(channel.annotations.get).toHaveBeenCalledWith("serial-001", {
        limit: 100,
      });
    });

    it("should output JSON when --json flag is used", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");
      channel.annotations.get.mockResolvedValue({
        items: [
          {
            type: "reactions:flag.v1",
            name: "thumbsup",
            clientId: "user-1",
          },
        ],
      });

      const records = await captureJsonLogs(async () => {
        await runCommand(
          ["channels:annotations:get", "test-channel", "serial-001", "--json"],
          import.meta.url,
        );
      });

      expect(records.length).toBeGreaterThanOrEqual(1);
      const result = records[0];
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "channels:annotations:get");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("channel", "test-channel");
      expect(result).toHaveProperty("serial", "serial-001");
      expect(result).toHaveProperty("annotations");
      expect(result.annotations as unknown[]).toHaveLength(1);
    });

    it("should display annotation details in human-readable output", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");
      channel.annotations.get.mockResolvedValue({
        items: [
          {
            type: "reactions:flag.v1",
            name: "thumbsup",
            clientId: "user-1",
            count: 5,
            data: { extra: "info" },
            timestamp: 1700000000000,
          },
        ],
      });

      const { stdout } = await runCommand(
        ["channels:annotations:get", "test-channel", "serial-001"],
        import.meta.url,
      );

      expect(stdout).toContain("reactions:flag.v1");
      expect(stdout).toContain("thumbsup");
      expect(stdout).toContain("user-1");
      expect(stdout).toContain("5");
    });
  });

  describe("error handling", () => {
    it("should handle API errors gracefully", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("test-channel");
      channel.annotations.get.mockRejectedValue(new Error("API error"));

      const { error } = await runCommand(
        ["channels:annotations:get", "test-channel", "serial-001"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("API error");
    });
  });
});
