import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  nockControl,
  controlApiCleanup,
} from "../../../helpers/control-api-test-helpers.js";
import { runCommand } from "@oclif/test";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

describe("stats:app command", () => {
  const mockAccessToken = "fake_access_token";
  const mockStats = [
    {
      intervalId: "2023-01-01:00:00",
      unit: "minute",
      all: {
        messages: { count: 100, data: 5000 },
        all: { count: 100, data: 5000 },
      },
    },
  ];

  let appId: string;

  beforeEach(() => {
    process.env.ABLY_ACCESS_TOKEN = mockAccessToken;
    const mockConfig = getMockConfigManager();
    appId = mockConfig.getCurrentAppId()!;
  });

  afterEach(() => {
    controlApiCleanup();
    delete process.env.ABLY_ACCESS_TOKEN;
  });

  standardHelpTests("stats:app", import.meta.url);
  standardArgValidationTests("stats:app", import.meta.url);
  standardFlagTests("stats:app", import.meta.url, [
    "--json",
    "--start",
    "--end",
    "--limit",
    "--unit",
  ]);

  describe("functionality", () => {
    it("should display app stats successfully", async () => {
      const scope = nockControl()
        .get(`/v1/apps/${appId}/stats`)
        .query(true)
        .reply(200, mockStats);

      const { stdout, error } = await runCommand(
        ["stats:app", appId, "--start", "1h"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      expect(scope.isDone()).toBe(true);
      expect(stdout).toContain("2023-01-01");
    });

    it("should accept ISO 8601 for --start and --end", async () => {
      const scope = nockControl()
        .get(`/v1/apps/${appId}/stats`)
        .query(true)
        .reply(200, mockStats);

      const { stdout } = await runCommand(
        [
          "stats:app",
          appId,
          "--start",
          "2023-01-01T00:00:00Z",
          "--end",
          "2023-01-02T00:00:00Z",
        ],
        import.meta.url,
      );

      expect(scope.isDone()).toBe(true);
      expect(stdout).toContain("2023-01-01");
    });

    it("should accept relative time for --start", async () => {
      const scope = nockControl()
        .get(`/v1/apps/${appId}/stats`)
        .query(true)
        .reply(200, mockStats);

      const { stdout } = await runCommand(
        ["stats:app", appId, "--start", "1h"],
        import.meta.url,
      );

      expect(scope.isDone()).toBe(true);
      expect(stdout).toContain("2023-01-01");
    });

    it("should accept Unix ms for --start", async () => {
      const scope = nockControl()
        .get(`/v1/apps/${appId}/stats`)
        .query(true)
        .reply(200, mockStats);

      const { stdout } = await runCommand(
        ["stats:app", appId, "--start", "1672531200000"],
        import.meta.url,
      );

      expect(scope.isDone()).toBe(true);
      expect(stdout).toContain("2023-01-01");
    });
  });

  describe("error handling", () => {
    it("should handle errors gracefully", async () => {
      nockControl()
        .get(`/v1/apps/${appId}/stats`)
        .query(true)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(["stats:app", appId], import.meta.url);
      expect(error).toBeDefined();
    });
  });
});
