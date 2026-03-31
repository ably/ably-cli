import { describe, it, expect, beforeEach } from "vitest";
import { runCommand } from "@oclif/test";
import { getMockAblyRest } from "../../../../helpers/mock-ably-rest.js";
import { parseNdjsonLines } from "../../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../../helpers/standard-tests.js";

describe("spaces:occupancy:get command", () => {
  beforeEach(() => {
    const mock = getMockAblyRest();
    mock.request.mockResolvedValue({
      items: [
        {
          status: {
            occupancy: {
              metrics: {
                connections: 10,
                presenceMembers: 8,
              },
            },
          },
        },
      ],
    });
  });

  standardHelpTests("spaces:occupancy:get", import.meta.url);

  standardArgValidationTests("spaces:occupancy:get", import.meta.url, {
    requiredArgs: ["test-space"],
  });

  standardFlagTests("spaces:occupancy:get", import.meta.url, ["--json"]);

  describe("functionality", () => {
    it("should retrieve and display occupancy data for a space", async () => {
      const mock = getMockAblyRest();

      const { stdout } = await runCommand(
        ["spaces:occupancy:get", "test-space"],
        import.meta.url,
      );

      expect(mock.request).toHaveBeenCalledOnce();
      const [method, path, version, params, body] = mock.request.mock.calls[0];
      expect(method).toBe("get");
      expect(path).toBe(
        `/channels/${encodeURIComponent("test-space::$space")}`,
      );
      expect(version).toBe(2);
      expect(params).toEqual({ occupancy: "metrics" });
      expect(body).toBeNull();

      expect(stdout).toContain("test-space");
      expect(stdout).toContain("Connections: 10");
      expect(stdout).toContain("Presence Members: 8");
      expect(stdout).not.toContain("Publishers:");
      expect(stdout).not.toContain("Subscribers:");
      expect(stdout).not.toContain("Presence Connections");
      expect(stdout).not.toContain("Presence Subscribers");
    });

    it("should output JSON envelope with spaceName and metrics", async () => {
      const { stdout } = await runCommand(
        ["spaces:occupancy:get", "test-space", "--json"],
        import.meta.url,
      );

      const records = parseNdjsonLines(stdout);
      const result = records.find((r) => r.type === "result");
      expect(result).toBeDefined();
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "spaces:occupancy:get");
      expect(result).toHaveProperty("success", true);
      const occupancy = (result as Record<string, unknown>).occupancy as Record<
        string,
        unknown
      >;
      expect(occupancy).toBeDefined();
      expect(occupancy).toHaveProperty("spaceName", "test-space");
      expect(occupancy).toHaveProperty("metrics");
      expect(occupancy.metrics).toMatchObject({
        connections: 10,
        presenceMembers: 8,
      });
      expect(occupancy.metrics).not.toHaveProperty("presenceConnections");
      expect(occupancy.metrics).not.toHaveProperty("presenceSubscribers");
      expect(occupancy.metrics).not.toHaveProperty("publishers");
      expect(occupancy.metrics).not.toHaveProperty("subscribers");
    });

    it("should handle empty occupancy metrics", async () => {
      const mock = getMockAblyRest();
      mock.request.mockResolvedValue({
        items: [{}],
      });

      const { stdout } = await runCommand(
        ["spaces:occupancy:get", "test-space"],
        import.meta.url,
      );

      expect(stdout).toContain("Connections: 0");
      expect(stdout).toContain("Presence Members: 0");
      expect(stdout).not.toContain("Publishers:");
      expect(stdout).not.toContain("Subscribers:");
      expect(stdout).not.toContain("Presence Connections");
      expect(stdout).not.toContain("Presence Subscribers");
    });
  });

  describe("error handling", () => {
    it("should handle API errors gracefully", async () => {
      const mock = getMockAblyRest();
      mock.request.mockRejectedValue(new Error("API error"));

      const { error } = await runCommand(
        ["spaces:occupancy:get", "test-space"],
        import.meta.url,
      );

      expect(error).toBeDefined();
    });
  });
});
