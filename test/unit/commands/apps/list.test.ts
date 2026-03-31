import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import {
  nockControl,
  controlApiCleanup,
  CONTROL_HOST,
} from "../../../helpers/control-api-test-helpers.js";
import { runCommand } from "@oclif/test";
import { parseJsonOutput } from "../../../helpers/ndjson.js";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

describe("apps:list command", () => {
  const mockAccessToken = "fake_access_token";
  const mockAccountId = "test-account-id";
  const mockApps = [
    {
      id: "550e8400-e29b-41d4-a716-446655440000",
      accountId: mockAccountId,
      name: "Test App 1",
      status: "active",
      created: 1640995200000,
      modified: 1640995200000,
      tlsOnly: false,
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440001",
      accountId: mockAccountId,
      name: "Test App 2",
      status: "active",
      created: 1640995200000,
      modified: 1640995200000,
      tlsOnly: true,
    },
  ];

  beforeEach(() => {
    // Set environment variable for access token
    process.env.ABLY_ACCESS_TOKEN = mockAccessToken;
  });

  afterEach(() => {
    // Clean up nock interceptors
    controlApiCleanup();
    delete process.env.ABLY_ACCESS_TOKEN;
  });

  describe("functionality", () => {
    it("should list apps successfully", async () => {
      // Mock the /me endpoint to get account ID
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the apps list endpoint
      nockControl()
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, mockApps);

      const { stdout } = await runCommand(["apps:list"], import.meta.url);

      expect(stdout).toContain("Test App 1");
      expect(stdout).toContain("Test App 2");
      expect(stdout).toContain("550e8400-e29b-41d4-a716-446655440000");
      expect(stdout).toContain("550e8400-e29b-41d4-a716-446655440001");
    });

    it("should output JSON format when --json flag is used", async () => {
      // Mock the /me endpoint
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the apps list endpoint
      nockControl()
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, mockApps);

      const { stdout } = await runCommand(
        ["apps:list", "--json"],
        import.meta.url,
      );

      const result = parseJsonOutput(stdout);
      expect(result).toHaveProperty("type", "result");
      expect(result).toHaveProperty("command", "apps:list");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("apps");
      expect(result.apps).toBeInstanceOf(Array);
      expect(result.apps).toHaveLength(2);
      expect(result.apps[0]).toHaveProperty(
        "id",
        "550e8400-e29b-41d4-a716-446655440000",
      );
      expect(result.apps[0]).toHaveProperty("name", "Test App 1");
      expect(result.apps[1]).toHaveProperty(
        "id",
        "550e8400-e29b-41d4-a716-446655440001",
      );
      expect(result.apps[1]).toHaveProperty("name", "Test App 2");
      expect(result.apps[0].created).toBe("2022-01-01T00:00:00.000Z");
      expect(result.apps[0].modified).toBe("2022-01-01T00:00:00.000Z");
    });

    it("should handle empty apps list", async () => {
      // Mock the /me endpoint
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the apps list endpoint with empty response
      nockControl().get(`/v1/accounts/${mockAccountId}/apps`).reply(200, []);

      const { stdout } = await runCommand(["apps:list"], import.meta.url);

      expect(stdout).toContain("No apps found");
    });

    it("should use ABLY_ACCESS_TOKEN environment variable when provided", async () => {
      const customToken = "custom_access_token";

      process.env.ABLY_ACCESS_TOKEN = customToken;

      // Mock the /me endpoint with custom token
      nock(CONTROL_HOST, {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the apps list endpoint
      nock(CONTROL_HOST, {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, mockApps);

      const { stdout } = await runCommand(["apps:list"], import.meta.url);

      expect(stdout).toContain("Test App 1");
      expect(stdout).toContain("Test App 2");
    });
  });

  standardHelpTests("apps:list", import.meta.url);
  standardArgValidationTests("apps:list", import.meta.url);
  standardFlagTests("apps:list", import.meta.url, ["--json"]);

  describe("error handling", () => {
    it("should handle 401 authentication error", async () => {
      // Mock authentication failure
      nockControl().get("/v1/me").reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(["apps:list"], import.meta.url);
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/401/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle 403 forbidden error", async () => {
      // Mock the /me endpoint
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock forbidden response
      nockControl()
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(403, { error: "Forbidden" });

      const { error } = await runCommand(["apps:list"], import.meta.url);
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/403/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle 500 server error", async () => {
      // Mock the /me endpoint
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock server error
      nockControl()
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(500, { error: "Internal Server Error" });

      const { error } = await runCommand(["apps:list"], import.meta.url);
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/500/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle network errors", async () => {
      // Mock network error
      nockControl().get("/v1/me").replyWithError("Network error");

      const { error } = await runCommand(["apps:list"], import.meta.url);
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Network error/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle rate limit errors", async () => {
      // Mock the /me endpoint
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock rate limit error
      nockControl()
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(429, { error: "Rate limit exceeded" });

      const { error } = await runCommand(["apps:list"], import.meta.url);
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/429/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });
  });

  describe("pagination handling", () => {
    it("should handle large lists", async () => {
      // Mock the /me endpoint
      nockControl()
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock large apps list with pagination
      const largeAppsList = Array.from({ length: 100 }, (_, i) => ({
        id: `550e8400-e29b-41d4-a716-44665544${i.toString().padStart(4, "0")}`,
        accountId: mockAccountId,
        name: `Test App ${i + 1}`,
        status: "active",
        created: 1640995200000,
        modified: 1640995200000,
        tlsOnly: false,
      }));

      nockControl()
        .get(`/v1/accounts/${mockAccountId}/apps`)
        .reply(200, largeAppsList, {
          Link: '<https://control.ably.net/v1/accounts/test-account-id/apps?limit=100&offset=100>; rel="next"',
        });

      const { stdout } = await runCommand(["apps:list"], import.meta.url);

      expect(stdout).toContain("Test App 1");
      expect(stdout).toContain("Test App 100");
    });
  });
});
