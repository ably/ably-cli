import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import {
  getMockAblyRest,
  createMockPaginatedResult,
} from "../../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("logs:connection-lifecycle:history command", () => {
  beforeEach(() => {
    const mock = getMockAblyRest();
    const channel = mock.channels._getChannel("[meta]connection.lifecycle");
    channel.history.mockResolvedValue(
      createMockPaginatedResult([
        {
          id: "msg-1",
          name: "connection.opened",
          data: { connectionId: "test-conn" },
          timestamp: Date.now(),
          clientId: "client-1",
          connectionId: "conn-1",
        },
      ]),
    );
  });

  standardHelpTests("logs:connection-lifecycle:history", import.meta.url);
  standardArgValidationTests(
    "logs:connection-lifecycle:history",
    import.meta.url,
  );
  standardFlagTests("logs:connection-lifecycle:history", import.meta.url, [
    "--limit",
    "--direction",
    "--json",
  ]);

  describe("functionality", () => {
    it("should retrieve connection lifecycle history and display results", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("[meta]connection.lifecycle");

      const { stdout } = await runCommand(
        ["logs:connection-lifecycle:history"],
        import.meta.url,
      );

      expect(stdout).toContain("Found");
      expect(stdout).toContain("1");
      expect(stdout).toContain("connection lifecycle log");
      expect(stdout).toContain("connection.opened");
      expect(channel.history).toHaveBeenCalled();
    });

    it("should include messages array in JSON output", async () => {
      const { stdout } = await runCommand(
        ["logs:connection-lifecycle:history", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("messages");
      expect(Array.isArray(result.messages)).toBe(true);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toHaveProperty("name", "connection.opened");
    });

    it("should handle empty history", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("[meta]connection.lifecycle");
      channel.history.mockResolvedValue(createMockPaginatedResult([]));

      const { stdout } = await runCommand(
        ["logs:connection-lifecycle:history"],
        import.meta.url,
      );

      expect(stdout).toContain("No connection lifecycle logs found");
    });

    it("should respect --limit flag", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("[meta]connection.lifecycle");

      await runCommand(
        ["logs:connection-lifecycle:history", "--limit", "50"],
        import.meta.url,
      );

      expect(channel.history).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50 }),
      );
    });

    it("should respect --direction flag", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("[meta]connection.lifecycle");

      await runCommand(
        ["logs:connection-lifecycle:history", "--direction", "forwards"],
        import.meta.url,
      );

      expect(channel.history).toHaveBeenCalledWith(
        expect.objectContaining({ direction: "forwards" }),
      );
    });
  });

  describe("error handling", () => {
    it("should handle API errors gracefully", async () => {
      const mock = getMockAblyRest();
      const channel = mock.channels._getChannel("[meta]connection.lifecycle");
      channel.history.mockRejectedValue(new Error("API error"));

      const { error } = await runCommand(
        ["logs:connection-lifecycle:history"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
