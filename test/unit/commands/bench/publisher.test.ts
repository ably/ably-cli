import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRealtime } from "../../../helpers/mock-ably-realtime.js";

describe("bench:publisher command", () => {
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
    channel.presence.enter.mockImplementation(async () => {});
    channel.presence.leave.mockImplementation(async () => {});
    channel.presence.get.mockResolvedValue([
      {
        clientId: "subscriber-1",
        connectionId: "conn-subscriber-1",
        data: { role: "subscriber" },
        action: "present",
        timestamp: Date.now(),
      },
    ]);
    channel.presence.unsubscribe.mockImplementation(() => {});
    channel.presence.subscribe.mockImplementation(() => {});
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["bench:publisher", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("Run a publisher benchmark test");
      expect(stdout).toContain("USAGE");
    });

    it("should display examples in help", async () => {
      const { stdout } = await runCommand(
        ["bench:publisher", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("EXAMPLES");
    });
  });

  describe("argument validation", () => {
    it("should require channel argument", async () => {
      const { error } = await runCommand(["bench:publisher"], import.meta.url);

      expect(error).toBeDefined();
      expect(error?.message).toContain("Missing 1 required arg");
    });
  });

  describe("functionality", () => {
    it("should run publisher benchmark and output JSON results", async () => {
      const { stdout } = await runCommand(
        [
          "bench:publisher",
          "test-channel",
          "--messages",
          "2",
          "--rate",
          "10",
          "--message-size",
          "50",
          "--json",
        ],
        import.meta.url,
      );

      const records = stdout
        .trim()
        .split("\n")
        .map((line: string) => JSON.parse(line));
      const result = records.find(
        (r: Record<string, unknown>) => r.type === "result",
      );
      expect(result).toBeDefined();
      expect(result).toHaveProperty("command", "bench:publisher");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("benchmark");
      expect(result.benchmark).toHaveProperty("messagesSent");
      expect(result.benchmark).toHaveProperty("testId");
      expect(result.benchmark).toHaveProperty("transport");
    }, 15_000);

    it("should publish messages to the specified channel", async () => {
      const mock = getMockAblyRealtime();
      const channel = mock.channels._getChannel("test-channel");

      await runCommand(
        [
          "bench:publisher",
          "test-channel",
          "--messages",
          "2",
          "--rate",
          "10",
          "--json",
        ],
        import.meta.url,
      );

      expect(channel.publish).toHaveBeenCalled();
    }, 15_000);
  });

  describe("flags", () => {
    it("should accept --messages flag", async () => {
      const { stdout } = await runCommand(
        ["bench:publisher", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--messages");
    });

    it("should accept --rate flag", async () => {
      const { stdout } = await runCommand(
        ["bench:publisher", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--rate");
    });

    it("should accept --transport flag", async () => {
      const { stdout } = await runCommand(
        ["bench:publisher", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--transport");
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

    it("should accept --client-id flag", async () => {
      const { stdout } = await runCommand(
        ["bench:publisher", "--help"],
        import.meta.url,
      );

      expect(stdout).toContain("--client-id");
    });
  });

  describe("error handling", () => {
    it("should reject unknown flags", async () => {
      const { error } = await runCommand(
        ["bench:publisher", "test-channel", "--unknown-flag"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/unknown|Nonexistent flag/i);
    });

    it("should reject invalid transport option", async () => {
      const { error } = await runCommand(
        ["bench:publisher", "test-channel", "--transport", "invalid"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Expected.*rest.*realtime/i);
    });
  });
});
