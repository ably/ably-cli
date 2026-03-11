import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyChat } from "../../../../helpers/mock-ably-chat.js";

describe("rooms:occupancy:get command", () => {
  beforeEach(() => {
    getMockAblyChat();
  });

  describe("functionality", () => {
    it("should display occupancy metrics", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");
      room.occupancy.get.mockResolvedValue({
        connections: 5,
        presenceMembers: 3,
      });

      const { stdout } = await runCommand(
        ["rooms:occupancy:get", "test-room"],
        import.meta.url,
      );

      expect(room.attach).toHaveBeenCalled();
      expect(room.occupancy.get).toHaveBeenCalled();
      expect(stdout).toContain("Connections: 5");
      expect(stdout).toContain("Presence Members: 3");
    });

    it("should handle zero metrics", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");
      room.occupancy.get.mockResolvedValue({
        connections: 0,
        presenceMembers: 0,
      });

      const { stdout } = await runCommand(
        ["rooms:occupancy:get", "test-room"],
        import.meta.url,
      );

      expect(stdout).toContain("Connections: 0");
      expect(stdout).toContain("Presence Members: 0");
    });

    it("should output JSON with metrics", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");
      room.occupancy.get.mockResolvedValue({
        connections: 10,
        presenceMembers: 7,
      });

      const { stdout } = await runCommand(
        ["rooms:occupancy:get", "test-room", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("room", "test-room");
      expect(result).toHaveProperty("metrics");
      expect(result.metrics.connections).toBe(10);
      expect(result.metrics.presenceMembers).toBe(7);
    });

    it("should output JSON error on failure", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");
      room.attach.mockImplementation(async () => {
        throw new Error("Room attach timeout");
      });

      const { stdout } = await runCommand(
        ["rooms:occupancy:get", "test-room", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
    });
  });

  describe("help", () => {
    it("should display help with --help flag", async () => {
      const { stdout } = await runCommand(
        ["rooms:occupancy:get", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("USAGE");
    });
  });

  describe("argument validation", () => {
    it("should require room argument", async () => {
      const { error } = await runCommand(
        ["rooms:occupancy:get"],
        import.meta.url,
      );
      expect(error?.message).toMatch(/room|required|Missing/i);
    });
  });

  describe("flags", () => {
    it("should accept --json flag", async () => {
      const { stdout } = await runCommand(
        ["rooms:occupancy:get", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("--json");
    });
  });

  describe("error handling", () => {
    it("should handle occupancy fetch failure gracefully", async () => {
      const chatMock = getMockAblyChat();
      const room = chatMock.rooms._getRoom("test-room");
      room.occupancy.get.mockRejectedValue(new Error("Service unavailable"));

      const { error } = await runCommand(
        ["rooms:occupancy:get", "test-room"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Service unavailable");
    });
  });
});
