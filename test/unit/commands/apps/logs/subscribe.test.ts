import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";

describe("apps:logs:subscribe command", () => {
  beforeEach(() => {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("[meta]log");

    // Configure connection.once to immediately call callback for 'connected'
    mock.connection.once.mockImplementation(
      (event: string, callback: () => void) => {
        if (event === "connected") {
          callback();
        }
      },
    );

    // Configure channel.once to immediately call callback for 'attached'
    channel.once.mockImplementation((event: string, callback: () => void) => {
      if (event === "attached") {
        channel.state = "attached";
        callback();
      }
    });
  });

  describe("command flags", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["apps:logs:subscribe", "--unknown-flag-xyz"],
        import.meta.url,
      );

      // Unknown flag should cause an error
      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });

  describe("alias behavior", () => {
    it("should delegate to logs:app:subscribe with --rewind flag", async () => {
      const mock = getMockAblyRealtime();

      const { stdout } = await runCommand(
        ["apps:logs:subscribe", "--rewind", "5"],
        import.meta.url,
      );

      // Should delegate to logs:app:subscribe and show subscription message
      expect(stdout).toContain("Subscribing to app logs");
      // Verify rewind was passed through
      expect(mock.channels.get).toHaveBeenCalledWith("[meta]log", {
        params: { rewind: "5" },
      });
    });

    it("should accept --json flag", async () => {
      const { error } = await runCommand(
        ["apps:logs:subscribe", "--json"],
        import.meta.url,
      );

      // Should not have unknown flag error
      expect(error?.message || "").not.toMatch(/unknown|Nonexistent flag/i);
    });
  });
});
