import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";
import { captureJsonLogs } from "../../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("channels:annotations:delete command", () => {
  beforeEach(() => {
    const mock = getMockAblyRealtime();

    // Configure connection.once to immediately call callback for 'connected'
    mock.connection.once.mockImplementation(
      (event: string, callback: () => void) => {
        if (event === "connected") {
          callback();
        }
      },
    );
  });

  standardHelpTests("channels:annotations:delete", import.meta.url);
  standardArgValidationTests("channels:annotations:delete", import.meta.url, {
    requiredArgs: ["test-channel", "serial-001", "reactions:flag.v1"],
  });
  standardFlagTests("channels:annotations:delete", import.meta.url, [
    "--json",
    "--name",
  ]);

  describe("functionality", () => {
    it("should delete an annotation successfully", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-channel");

      const { stdout } = await runCommand(
        [
          "channels:annotations:delete",
          "test-channel",
          "serial-001",
          "reactions:flag.v1",
        ],
        import.meta.url,
      );

      expect(mock.channels.get).toHaveBeenCalledWith("test-channel");
      expect(channel.annotations.delete).toHaveBeenCalledExactlyOnceWith(
        "serial-001",
        {
          type: "reactions:flag.v1",
        },
      );
      expect(stdout).toContain("Annotation deleted");
    });

    it("should pass --name flag to annotation", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        [
          "channels:annotations:delete",
          "test-channel",
          "serial-001",
          "reactions:flag.v1",
          "--name",
          "thumbsup",
        ],
        import.meta.url,
      );

      expect(channel.annotations.delete).toHaveBeenCalledWith("serial-001", {
        type: "reactions:flag.v1",
        name: "thumbsup",
      });
    });

    it("should succeed with multiple.v1 delete + --name (no count needed)", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-channel");

      const { stdout } = await runCommand(
        [
          "channels:annotations:delete",
          "test-channel",
          "serial-001",
          "reactions:multiple.v1",
          "--name",
          "thumbsup",
        ],
        import.meta.url,
      );

      expect(channel.annotations.delete).toHaveBeenCalledWith("serial-001", {
        type: "reactions:multiple.v1",
        name: "thumbsup",
      });
      expect(stdout).toContain("Annotation deleted");
    });

    it("should output JSON when --json flag is used", async () => {
      const records = await captureJsonLogs(async () => {
        await runCommand(
          [
            "channels:annotations:delete",
            "test-channel",
            "serial-001",
            "reactions:flag.v1",
            "--json",
          ],
          import.meta.url,
        );
      });

      expect(records.length).toBeGreaterThanOrEqual(1);
      const result = records[0];
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "channels:annotations:delete");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("annotation");
      expect(result.annotation).toHaveProperty("channel", "test-channel");
      expect(result.annotation).toHaveProperty("serial", "serial-001");
    });

    it("should not include name in JSON output when not provided", async () => {
      const records = await captureJsonLogs(async () => {
        await runCommand(
          [
            "channels:annotations:delete",
            "test-channel",
            "serial-001",
            "reactions:flag.v1",
            "--json",
          ],
          import.meta.url,
        );
      });

      const result = records[0];
      expect(result.annotation).not.toHaveProperty("name");
    });

    it("should include name in JSON output when provided", async () => {
      const records = await captureJsonLogs(async () => {
        await runCommand(
          [
            "channels:annotations:delete",
            "test-channel",
            "serial-001",
            "reactions:flag.v1",
            "--name",
            "thumbsup",
            "--json",
          ],
          import.meta.url,
        );
      });

      const result = records[0];
      expect(result.annotation).toHaveProperty("name", "thumbsup");
    });
  });

  describe("error handling", () => {
    it("should error when --name is missing for distinct.v1 type", async () => {
      const { error } = await runCommand(
        [
          "channels:annotations:delete",
          "test-channel",
          "serial-001",
          "reactions:distinct.v1",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("--name is required");
    });

    it("should error when --name is missing for unique.v1 type", async () => {
      const { error } = await runCommand(
        [
          "channels:annotations:delete",
          "test-channel",
          "serial-001",
          "reactions:unique.v1",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("--name is required");
    });

    it("should error on invalid annotation type format", async () => {
      const { error } = await runCommand(
        [
          "channels:annotations:delete",
          "test-channel",
          "serial-001",
          "invalidformat",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Invalid annotation type format");
    });

    it("should handle API errors gracefully", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-channel");
      channel.annotations.delete.mockRejectedValue(new Error("API error"));

      const { error } = await runCommand(
        [
          "channels:annotations:delete",
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
