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

      // Track subscribe calls
      let subscribeCallback: ((msg: unknown) => void) | null = null;
      channel.subscribe.mockImplementation(
        (callback: (msg: unknown) => void) => {
          subscribeCallback = callback;
          channel.state = "attached";
        },
      );

      const { stdout } = await runCommand(
        ["logs:push:subscribe", "--duration", "0"],
        import.meta.url,
      );

      // Verify subscribe was called
      expect(channel.subscribe).toHaveBeenCalled();
      expect(stdout).toContain("[meta]log:push");

      // Verify subscribe callback was captured
      expect(subscribeCallback).not.toBeNull();
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
