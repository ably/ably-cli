import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../../helpers/mock-ably-realtime.js";

describe("logs:push:subscribe command", () => {
  beforeEach(() => {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("[meta]log:push");

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

  describe("subscription", () => {
    it("should subscribe to [meta]log:push channel", async () => {
      const mock = getMockAblyRealtime();

      await runCommand(
        ["logs:push:subscribe", "--duration", "0"],
        import.meta.url,
      );

      expect(mock.channels.get).toHaveBeenCalledWith(
        "[meta]log:push",
        expect.any(Object),
      );
    });

    it("should handle messages with severity field", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("[meta]log:push");

      // Track subscribe calls and invoke callback with a test message
      channel.subscribe.mockImplementation(
        (callback: (msg: unknown) => void) => {
          channel.state = "attached";
          callback({
            name: "push.sent",
            timestamp: 1700000000000,
            data: { severity: "warning", message: "Push delivery delayed" },
          });
        },
      );

      const { stdout } = await runCommand(
        ["logs:push:subscribe", "--duration", "0"],
        import.meta.url,
      );

      // Verify subscribe was called and message was rendered
      expect(channel.subscribe).toHaveBeenCalled();
      expect(stdout).toContain("[meta]log:push");
      expect(stdout).toContain("push.sent");
      expect(stdout).toContain("Push delivery delayed");
    });

    it("should set rewind channel param when --rewind > 0", async () => {
      const mock = getMockAblyRealtime();

      await runCommand(
        ["logs:push:subscribe", "--rewind", "5", "--duration", "0"],
        import.meta.url,
      );

      expect(mock.channels.get).toHaveBeenCalledWith("[meta]log:push", {
        params: { rewind: "5" },
      });
    });
  });
});
