import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../helpers/mock-ably-realtime.js";

describe("bench:subscriber command", () => {
  beforeEach(() => {
    const mock = getMockAblyRealtime();
    const channel = mock.channels._getChannel("test-channel");

    mock.connection.id = "conn-123";
    mock.connection.state = "connected";
    mock.connection.once.mockImplementation(
      (event: string, callback: () => void) => {
        if (event === "connected") {
          setTimeout(() => callback(), 5);
        }
      },
    );
    mock.auth.clientId = "test-client-id";

    channel.publish.mockImplementation(async () => {});
    channel.subscribe.mockImplementation(() => {});
    channel.presence.enter.mockImplementation(async () => {});
    channel.presence.leave.mockImplementation(async () => {});
    channel.presence.get.mockResolvedValue([]);
    channel.presence.unsubscribe.mockImplementation(() => {});
    channel.presence.subscribe.mockImplementation(() => {});
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["bench:subscriber", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Run a subscriber benchmark test");
      expect(stdout).toContain("USAGE");
    });

    it("should display examples in help", async () => {
      const { stdout } = await runCommand(
        ["bench:subscriber", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("EXAMPLES");
    });
  });

  describe("argument validation", () => {
    it("should require channel argument", async () => {
      const { error } = await runCommand(["bench:subscriber"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toContain("Missing 1 required arg");
    });
  });

  describe("functionality", () => {
    it("should subscribe to the specified channel with duration flag", async () => {
      const { stdout } = await runCommand(
        ["bench:subscriber", "test-channel"],
        import.meta.url,
      );

      // Should show subscription message
      expect(stdout).toContain("test-channel");
    }, 10_000);

    it("should output subscription status", async () => {
      const { stdout } = await runCommand(
        ["bench:subscriber", "test-channel"],
        import.meta.url,
      );

      expect(stdout).toContain("Subscribed to channel");
    }, 10_000);
  });

  describe("flags", () => {
    it("should accept --duration flag", async () => {
      const { stdout } = await runCommand(
        ["bench:subscriber", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--duration");
    });

    it("should accept --client-id flag", async () => {
      const { stdout } = await runCommand(
        ["bench:subscriber", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--client-id");
    });

    it("should accept --json flag", async () => {
      const { stdout } = await runCommand(
        ["bench:subscriber", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--json");
    });
  });

  describe("error handling", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["bench:subscriber", "test-channel", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
    });
  });
});
