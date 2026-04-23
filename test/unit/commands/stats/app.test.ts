import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  nockControl,
  controlApiCleanup,
  mockAppResolution,
} from "../../../helpers/control-api-test-helpers.js";
import { runCommand } from "@oclif/test";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
  standardControlApiErrorTests,
} from "../../../helpers/standard-tests.js";
import { mockStats as mockStatsFactory } from "../../../fixtures/control-api.js";

describe("stats:app command", () => {
  const mockAccessToken = "fake_access_token";
  const mockStatsData = [mockStatsFactory()];

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
      mockAppResolution(appId);
      const scope = nockControl()
        .get(`/v1/apps/${appId}/stats`)
        .query(true)
        .reply(200, mockStatsData);

      const { stdout, error } = await runCommand(
        ["stats:app", appId, "--start", "1h"],
        import.meta.url,
      );

      expect(error).toBeUndefined();
      expect(scope.isDone()).toBe(true);
      expect(stdout).toContain("2023-01-01");
    });

    it("should accept ISO 8601 for --start and --end", async () => {
      mockAppResolution(appId);
      const scope = nockControl()
        .get(`/v1/apps/${appId}/stats`)
        .query(true)
        .reply(200, mockStatsData);

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
      mockAppResolution(appId);
      const scope = nockControl()
        .get(`/v1/apps/${appId}/stats`)
        .query(true)
        .reply(200, mockStatsData);

      const { stdout } = await runCommand(
        ["stats:app", appId, "--start", "1h"],
        import.meta.url,
      );

      expect(scope.isDone()).toBe(true);
      expect(stdout).toContain("2023-01-01");
    });

    it("should accept Unix ms for --start", async () => {
      mockAppResolution(appId);
      const scope = nockControl()
        .get(`/v1/apps/${appId}/stats`)
        .query(true)
        .reply(200, mockStatsData);

      const { stdout } = await runCommand(
        ["stats:app", appId, "--start", "1672531200000"],
        import.meta.url,
      );

      expect(scope.isDone()).toBe(true);
      expect(stdout).toContain("2023-01-01");
    });
  });

  describe("error handling", () => {
    standardControlApiErrorTests({
      commandArgs: ["stats:app"],
      importMetaUrl: import.meta.url,
      setupNock: (scenario) => {
        const errorAppId = getMockConfigManager().getCurrentAppId()!;
        const scope = nockControl()
          .get(`/v1/apps/${errorAppId}/stats`)
          .query(true);
        if (scenario === "401") scope.reply(401, { error: "Unauthorized" });
        else if (scenario === "500")
          scope.reply(500, { error: "Internal Server Error" });
        else scope.replyWithError("Network error");
      },
    });
  });
});
