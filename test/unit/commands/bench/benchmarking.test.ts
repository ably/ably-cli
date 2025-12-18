import { describe, it, expect, beforeEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../helpers/mock-ably-realtime.js";
import { getMockAblyRest } from "../../../helpers/mock-ably-rest.js";

describe("benchmarking commands", { timeout: 20000 }, () => {
  beforeEach(() => {
    const realtimeMock = getMockAblyRealtime();
    const restMock = getMockAblyRest();
    const channel = realtimeMock.channels._getChannel("test-channel");
    const restChannel = restMock.channels._getChannel("test-channel");

    // Configure realtime connection
    realtimeMock.connection.id = "conn-123";
    realtimeMock.connection.state = "connected";
    realtimeMock.connection.once.mockImplementation(
      (event: string, callback: () => void) => {
        if (event === "connected") {
          setTimeout(() => callback(), 5);
        }
      },
    );
    realtimeMock.auth = { clientId: "test-client-id" };

    // Configure channel publish
    channel.publish.mockImplementation(async () => {});

    // Configure presence
    channel.presence.enter.mockImplementation(async () => {});
    channel.presence.leave.mockImplementation(async () => {});
    channel.presence.get.mockResolvedValue([]);
    channel.presence.unsubscribe.mockImplementation(() => {});

    // Configure REST channel to use same pattern
    restChannel.publish.mockImplementation(async () => {});
  });

  describe("bench publisher", () => {
    describe("help", () => {
      it("should display help with --help flag", async () => {
        const { stdout } = await runCommand(
          ["bench:publisher", "--help"],
          import.meta.url,
        );

        expect(stdout).toContain("Run a publisher benchmark test");
        expect(stdout).toContain("USAGE");
        expect(stdout).toContain("CHANNEL");
      });

      it("should display examples in help", async () => {
        const { stdout } = await runCommand(
          ["bench:publisher", "--help"],
          import.meta.url,
        );

        expect(stdout).toContain("EXAMPLES");
        expect(stdout).toContain("bench publisher");
      });
    });

    describe("flags", () => {
      it("should accept --messages flag", async () => {
        const { stdout } = await runCommand(
          ["bench:publisher", "--help"],
          import.meta.url,
        );

        expect(stdout).toContain("--messages");
        expect(stdout).toContain("-m");
      });

      it("should accept --rate flag", async () => {
        const { stdout } = await runCommand(
          ["bench:publisher", "--help"],
          import.meta.url,
        );

        expect(stdout).toContain("--rate");
        expect(stdout).toContain("-r");
      });

      it("should accept --transport flag", async () => {
        const { stdout } = await runCommand(
          ["bench:publisher", "--help"],
          import.meta.url,
        );

        expect(stdout).toContain("--transport");
        expect(stdout).toContain("rest");
        expect(stdout).toContain("realtime");
      });

      it("should accept --message-size flag", async () => {
        const { stdout } = await runCommand(
          ["bench:publisher", "--help"],
          import.meta.url,
        );

        expect(stdout).toContain("--message-size");
      });

      it("should accept --wait-for-subscribers flag", async () => {
        const { stdout } = await runCommand(
          ["bench:publisher", "--help"],
          import.meta.url,
        );

        expect(stdout).toContain("--wait-for-subscribers");
      });
    });

    describe("argument validation", () => {
      it("should require channel argument", async () => {
        const { error } = await runCommand(
          ["bench:publisher", "--api-key", "app.key:secret"],
          import.meta.url,
        );

        expect(error).toBeDefined();
        expect(error?.message).toMatch(/missing.*channel|required/i);
      });
    });

    describe("publishing functionality", () => {
      it("should publish messages at the specified rate", async () => {
        const realtimeMock = getMockAblyRealtime();
        const channel = realtimeMock.channels._getChannel("test-channel");

        const { stdout } = await runCommand(
          [
            "bench:publisher",
            "test-channel",
            "--api-key",
            "app.key:secret",
            "--messages",
            "5",
            "--rate",
            "5",
            "--message-size",
            "100",
            "--json",
          ],
          import.meta.url,
        );

        // Should have output (benchmark complete message or JSON output)
        expect(stdout.length).toBeGreaterThan(0);

        // Wait for all messages to be published (5 test messages + 2 control envelopes = 7 calls)
        await vi.waitFor(
          () => {
            expect(channel.publish).toHaveBeenCalledTimes(7);
          },
          { timeout: 5000 },
        );
      });

      it("should enter presence before publishing", async () => {
        const realtimeMock = getMockAblyRealtime();
        const channel = realtimeMock.channels._getChannel("test-channel");

        await runCommand(
          [
            "bench:publisher",
            "test-channel",
            "--api-key",
            "app.key:secret",
            "--messages",
            "3",
            "--rate",
            "10",
            "--json",
          ],
          import.meta.url,
        );

        expect(channel.presence.enter).toHaveBeenCalled();
      });

      it("should wait for subscribers via presence.get when flag is set", async () => {
        const realtimeMock = getMockAblyRealtime();
        const channel = realtimeMock.channels._getChannel("test-channel");

        // Mock subscriber already present
        const mockSubscriber = {
          clientId: "subscriber1",
          data: { role: "subscriber" },
        };
        channel.presence.get.mockResolvedValue([mockSubscriber]);

        await runCommand(
          [
            "bench:publisher",
            "test-channel",
            "--api-key",
            "app.key:secret",
            "--messages",
            "2",
            "--rate",
            "10",
            "--wait-for-subscribers",
            "--json",
          ],
          import.meta.url,
        );

        expect(channel.presence.subscribe).toHaveBeenCalledWith(
          "enter",
          expect.any(Function),
        );
        expect(channel.presence.unsubscribe).toHaveBeenCalledWith(
          "enter",
          expect.any(Function),
        );
        expect(channel.presence.get).toHaveBeenCalled();
      });
    });

    it("should wait for subscribers via presence.subscribe when flag is set", async () => {
      const realtimeMock = getMockAblyRealtime();
      const channel = realtimeMock.channels._getChannel("test-channel");

      // Mock subscriber already present
      const mockSubscriber = {
        clientId: "subscriber1",
        data: { role: "subscriber" },
      };
      channel.presence.subscribe.mockImplementation(
        (event: string, listener: (member: unknown) => void) => {
          setTimeout(() => {
            listener(mockSubscriber);
          }, 1000);
        },
      );

      await runCommand(
        [
          "bench:publisher",
          "test-channel",
          "--api-key",
          "app.key:secret",
          "--messages",
          "2",
          "--rate",
          "10",
          "--wait-for-subscribers",
          "--json",
        ],
        import.meta.url,
      );

      expect(channel.presence.subscribe).toHaveBeenCalledWith(
        "enter",
        expect.any(Function),
      );
      expect(channel.presence.unsubscribe).toHaveBeenCalledWith(
        "enter",
        expect.any(Function),
      );
      expect(channel.presence.get).toHaveBeenCalled();
    });
  });

  describe("bench subscriber", () => {
    describe("help", () => {
      it("should display help with --help flag", async () => {
        const { stdout } = await runCommand(
          ["bench:subscriber", "--help"],
          import.meta.url,
        );

        expect(stdout).toContain("Run a subscriber benchmark test");
        expect(stdout).toContain("USAGE");
        expect(stdout).toContain("CHANNEL");
      });

      it("should display examples in help", async () => {
        const { stdout } = await runCommand(
          ["bench:subscriber", "--help"],
          import.meta.url,
        );

        expect(stdout).toContain("EXAMPLES");
        expect(stdout).toContain("bench subscriber");
      });
    });

    describe("flags", () => {
      it("should accept --duration flag", async () => {
        const { stdout } = await runCommand(
          ["bench:subscriber", "--help"],
          import.meta.url,
        );

        expect(stdout).toContain("--duration");
        expect(stdout).toContain("-d");
      });
    });

    describe("argument validation", () => {
      it("should require channel argument", async () => {
        const { error } = await runCommand(
          ["bench:subscriber", "--api-key", "app.key:secret"],
          import.meta.url,
        );

        expect(error).toBeDefined();
        expect(error?.message).toMatch(/missing.*channel|required/i);
      });
    });

    describe("subscription functionality", () => {
      it("should subscribe to channel and enter presence", async () => {
        const realtimeMock = getMockAblyRealtime();
        const channel = realtimeMock.channels._getChannel("test-channel");

        const { error } = await runCommand(
          ["bench:subscriber", "test-channel", "--api-key", "app.key:secret"],
          import.meta.url,
        );

        // Command should complete without error (uses duration from env var in test mode)
        expect(error).toBeUndefined();

        // Should have subscribed and entered presence
        expect(channel.subscribe).toHaveBeenCalled();
        expect(channel.presence.enter).toHaveBeenCalledWith({
          role: "subscriber",
        });
      });
    });
  });
});
