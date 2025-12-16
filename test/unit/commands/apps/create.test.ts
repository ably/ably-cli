import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";

describe("apps:create command", () => {
  const mockAppName = "TesttApp";
  const newAppId = "new-app-id-12345";

  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe("successful app creation", () => {
    it("should create an app successfully", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const accountName = mock.getCurrentAccount()!.accountName!;
      const userEmail = mock.getCurrentAccount()!.userEmail!;

      // Mock the /me endpoint to get account ID
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: accountName },
          user: { email: userEmail },
        });

      // Mock the app creation endpoint
      nock("https://control.ably.net")
        .post(`/v1/accounts/${accountId}/apps`, {
          name: mockAppName,
          tlsOnly: false,
        })
        .reply(201, {
          id: newAppId,
          accountId: accountId,
          name: mockAppName,
          status: "active",
          created: Date.now(),
          modified: Date.now(),
          tlsOnly: false,
        });

      const { stdout } = await runCommand([
        "apps:create",
        "--name",
        `"${mockAppName}"`,
      ]);

      expect(stdout).toContain("App created successfully");
      expect(stdout).toContain(newAppId);
      expect(stdout).toContain(mockAppName);
      expect(stdout).toContain("Automatically switched to app");
    });

    it("should create an app with TLS only flag", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const accountName = mock.getCurrentAccount()!.accountName!;
      const userEmail = mock.getCurrentAccount()!.userEmail!;

      // Mock the /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: accountName },
          user: { email: userEmail },
        });

      // Mock the app creation endpoint with TLS only
      nock("https://control.ably.net")
        .post(`/v1/accounts/${accountId}/apps`, {
          name: mockAppName,
          tlsOnly: true,
        })
        .reply(201, {
          id: newAppId,
          accountId: accountId,
          name: mockAppName,
          status: "active",
          created: Date.now(),
          modified: Date.now(),
          tlsOnly: true,
        });

      const { stdout } = await runCommand(
        ["apps:create", "--name", `"${mockAppName}"`, "--tls-only"],
        import.meta.url,
      );

      expect(stdout).toContain("App created successfully");
      expect(stdout).toContain("TLS Only: Yes");
      expect(stdout).toContain("Automatically switched to app");
    });

    it("should output JSON format when --json flag is used", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const accountName = mock.getCurrentAccount()!.accountName!;
      const userEmail = mock.getCurrentAccount()!.userEmail!;

      const mockApp = {
        id: newAppId,
        accountId: accountId,
        name: mockAppName,
        status: "active",
        created: Date.now(),
        modified: Date.now(),
        tlsOnly: false,
      };

      // Mock the /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: accountName },
          user: { email: userEmail },
        });

      // Mock the app creation endpoint
      nock("https://control.ably.net")
        .post(`/v1/accounts/${accountId}/apps`)
        .reply(201, mockApp);

      const { stdout } = await runCommand(
        ["apps:create", "--name", `"${mockAppName}"`, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("app");
      expect(result.app).toHaveProperty("id", newAppId);
      expect(result.app).toHaveProperty("name", mockAppName);
      expect(result).toHaveProperty("success", true);
    });

    it("should use custom access token when provided", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const accountName = mock.getCurrentAccount()!.accountName!;
      const userEmail = mock.getCurrentAccount()!.userEmail!;
      const customToken = "custom_access_token";

      // Mock the /me endpoint with custom token
      nock("https://control.ably.net", {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: accountName },
          user: { email: userEmail },
        });

      // Mock the app creation endpoint
      nock("https://control.ably.net", {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .post(`/v1/accounts/${accountId}/apps`)
        .reply(201, {
          id: newAppId,
          accountId: accountId,
          name: mockAppName,
          status: "active",
          created: Date.now(),
          modified: Date.now(),
          tlsOnly: false,
        });

      const { stdout } = await runCommand(
        [
          "apps:create",
          "--name",
          mockAppName,
          "--access-token",
          "custom_access_token",
        ],
        import.meta.url,
      );

      expect(stdout).toContain("App created successfully");
      expect(stdout).toContain("Automatically switched to app");
    });

    it("should automatically switch to the newly created app", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const accountName = mock.getCurrentAccount()!.accountName!;
      const userEmail = mock.getCurrentAccount()!.userEmail!;

      // Mock the /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: accountName },
          user: { email: userEmail },
        });

      // Mock the app creation endpoint
      nock("https://control.ably.net")
        .post(`/v1/accounts/${accountId}/apps`)
        .reply(201, {
          id: newAppId,
          accountId: accountId,
          name: mockAppName,
          status: "active",
          created: Date.now(),
          modified: Date.now(),
          tlsOnly: false,
        });

      const { stdout } = await runCommand(
        ["apps:create", "--name", `"${mockAppName}"`],
        import.meta.url,
      );

      expect(stdout).toContain("App created successfully");
      expect(stdout).toContain(
        `Automatically switched to app: ${mockAppName} (${newAppId})`,
      );

      // Verify the mock config was updated with the new app
      expect(mock.getCurrentAppId()).toBe(newAppId);
      expect(mock.getAppName(newAppId)).toBe(mockAppName);
    });
  });

  describe("error handling", () => {
    it("should handle 401 authentication error", async () => {
      // Mock authentication failure
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["apps:create", "--name", `"${mockAppName}"`],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error.message).toMatch(/401/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle 403 forbidden error", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const accountName = mock.getCurrentAccount()!.accountName!;
      const userEmail = mock.getCurrentAccount()!.userEmail!;

      // Mock the /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: accountName },
          user: { email: userEmail },
        });

      // Mock forbidden response
      nock("https://control.ably.net")
        .post(`/v1/accounts/${accountId}/apps`)
        .reply(403, { error: "Forbidden" });

      const { error } = await runCommand(
        ["apps:create", "--name", `"${mockAppName}"`],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error.message).toMatch(/403/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle 404 not found error", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const accountName = mock.getCurrentAccount()!.accountName!;
      const userEmail = mock.getCurrentAccount()!.userEmail!;

      // Mock the /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: accountName },
          user: { email: userEmail },
        });

      // Mock not found response
      nock("https://control.ably.net")
        .post(`/v1/accounts/${accountId}/apps`)
        .reply(404, { error: "Not Found" });

      const { error } = await runCommand(
        ["apps:create", "--name", `"${mockAppName}"`],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error.message).toMatch(/404/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle 500 server error", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const accountName = mock.getCurrentAccount()!.accountName!;
      const userEmail = mock.getCurrentAccount()!.userEmail!;

      // Mock the /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: accountName },
          user: { email: userEmail },
        });

      // Mock server error
      nock("https://control.ably.net")
        .post(`/v1/accounts/${accountId}/apps`)
        .reply(500, { error: "Internal Server Error" });

      const { error } = await runCommand(
        ["apps:create", "--name", `"${mockAppName}"`],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error.message).toMatch(/500/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should require name parameter", async () => {
      const { error } = await runCommand(["apps:create"], import.meta.url);
      expect(error).toBeDefined();
      expect(error.message).toMatch(/Missing required flag.*name/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle network errors", async () => {
      // Mock network error
      nock("https://control.ably.net")
        .get("/v1/me")
        .replyWithError("Network error");

      const { error } = await runCommand(
        ["apps:create", "--name", `"${mockAppName}"`],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error.message).toMatch(/Network error/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });

    it("should handle validation errors from API", async () => {
      const mock = getMockConfigManager();
      const accountId = mock.getCurrentAccount()!.accountId!;
      const accountName = mock.getCurrentAccount()!.accountName!;
      const userEmail = mock.getCurrentAccount()!.userEmail!;

      // Mock the /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: accountId, name: accountName },
          user: { email: userEmail },
        });

      // Mock validation error
      nock("https://control.ably.net")
        .post(`/v1/accounts/${accountId}/apps`)
        .reply(400, {
          error: "Validation failed",
          details: "App name already exists",
        });

      const { error } = await runCommand(
        ["apps:create", "--name", `"${mockAppName}"`],
        import.meta.url,
      );
      expect(error).toBeDefined();
      expect(error.message).toMatch(/400/);
      expect(error?.oclif?.exit).toBeGreaterThan(0);
    });
  });
});
