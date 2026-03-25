import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../../helpers/mock-ably-rest.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

const mockOccupancyMetrics = {
  connections: 10,
  presenceConnections: 5,
  presenceMembers: 8,
  presenceSubscribers: 4,
  publishers: 2,
  subscribers: 6,
  objectPublishers: 3,
  objectSubscribers: 7,
};

describe("rooms:occupancy:get command", () => {
  beforeEach(() => {
    const mock = getMockAblyRest();
    mock.request.mockResolvedValue({
      items: [
        {
          status: {
            occupancy: {
              metrics: mockOccupancyMetrics,
            },
          },
        },
      ],
    });
  });

  standardHelpTests("rooms:occupancy:get", import.meta.url);
  standardArgValidationTests("rooms:occupancy:get", import.meta.url, {
    requiredArgs: ["test-room"],
  });
  standardFlagTests("rooms:occupancy:get", import.meta.url, ["--json"]);

  describe("functionality", () => {
    it("should display all 8 occupancy metrics", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        ["rooms:occupancy:get", "test-room"],
        import.meta.url,
      );

      expect(mock.request).toHaveBeenCalledOnce();
      const [method, path, version, params] = mock.request.mock.calls[0];
      expect(method).toBe("get");
      expect(path).toBe("/channels/test-room%3A%3A%24chat");
      expect(version).toBe(2);
      expect(params).toEqual({ occupancy: "metrics" });

      expect(stdout).toContain("test-room");
      expect(stdout).toContain("Connections: 10");
      expect(stdout).toContain("Publishers: 2");
      expect(stdout).toContain("Subscribers: 6");
      expect(stdout).toContain("Presence Connections: 5");
      expect(stdout).toContain("Presence Members: 8");
      expect(stdout).toContain("Presence Subscribers: 4");
      expect(stdout).toContain("Object Publishers: 3");
      expect(stdout).toContain("Object Subscribers: 7");
    });

    it("should handle zero metrics", async () => {
      const mock = getMockAblyRest();
      mock.request.mockResolvedValue({
        items: [{}],
      });

      const { stdout } = await runCommand(
        ["rooms:occupancy:get", "test-room"],
        import.meta.url,
      );

      expect(stdout).toContain("Connections: 0");
      expect(stdout).toContain("Publishers: 0");
      expect(stdout).toContain("Subscribers: 0");
      expect(stdout).toContain("Presence Connections: 0");
      expect(stdout).toContain("Presence Members: 0");
      expect(stdout).toContain("Presence Subscribers: 0");
      expect(stdout).toContain("Object Publishers: 0");
      expect(stdout).toContain("Object Subscribers: 0");
    });

    it("should output JSON nested under occupancy key", async () => {
      const { stdout } = await runCommand(
        ["rooms:occupancy:get", "test-room", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("occupancy");
      expect(result.occupancy).toHaveProperty("roomName", "test-room");
      expect(result.occupancy.metrics).toMatchObject(mockOccupancyMetrics);
    });

    it("should output JSON error on failure", async () => {
      const mock = getMockAblyRest();
      mock.request.mockRejectedValue(new Error("Service unavailable"));

      const { stdout } = await runCommand(
        ["rooms:occupancy:get", "test-room", "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
    });
  });

  describe("error handling", () => {
    it("should handle occupancy fetch failure gracefully", async () => {
      const mock = getMockAblyRest();
      mock.request.mockRejectedValue(new Error("Service unavailable"));

      const { error } = await runCommand(
        ["rooms:occupancy:get", "test-room"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toContain("Service unavailable");
    });
  });
});
