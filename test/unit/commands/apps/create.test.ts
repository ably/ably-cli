import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { resolve } from "node:path";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";

describe("apps:create command", () => {
  const mockAccessToken = "fake_access_token";
  const mockAccountId = "test-account-id";
  const mockAppId = "550e8400-e29b-41d4-a716-446655440000";
  const mockAppName = "TesttApp";
  let testConfigDir: string;
  let originalConfigDir: string;

  beforeEach(() => {
    // Set environment variable for access token
    process.env.ABLY_ACCESS_TOKEN = mockAccessToken;

    // Create a temporary config directory for testing
    testConfigDir = resolve(tmpdir(), `ably-cli-test-${Date.now()}`);
    mkdirSync(testConfigDir, { recursive: true, mode: 0o700 });

    // Store original config dir and set test config dir
    originalConfigDir = process.env.ABLY_CLI_CONFIG_DIR || "";
    process.env.ABLY_CLI_CONFIG_DIR = testConfigDir;

    // Create a minimal config file with a default account
    const configContent = `[current]
account = "default"

[accounts.default]
accessToken = "${mockAccessToken}"
accountId = "${mockAccountId}"
accountName = "Test Account"
userEmail = "test@example.com"
`;
    writeFileSync(resolve(testConfigDir, "config"), configContent);
  });

  afterEach(() => {
    // Clean up nock interceptors
    nock.cleanAll();
    delete process.env.ABLY_ACCESS_TOKEN;

    // Restore original config directory
    if (originalConfigDir) {
      process.env.ABLY_CLI_CONFIG_DIR = originalConfigDir;
    } else {
      delete process.env.ABLY_CLI_CONFIG_DIR;
    }

    // Clean up test config directory
    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe("successful app creation", () => {
    it("should create an app successfully", async () => {
      // Mock the /me endpoint to get account ID
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the app creation endpoint
      nock("https://control.ably.net")
        .post(`/v1/accounts/${mockAccountId}/apps`, {
          name: mockAppName,
          tlsOnly: false,
        })
        .reply(201, {
          id: mockAppId,
          accountId: mockAccountId,
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
      expect(stdout).toContain(mockAppId);
      expect(stdout).toContain(mockAppName);
      expect(stdout).toContain("Automatically switched to app");
    });

    it("should create an app with TLS only flag", async () => {
      // Mock the /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the app creation endpoint with TLS only
      nock("https://control.ably.net")
        .post(`/v1/accounts/${mockAccountId}/apps`, {
          name: mockAppName,
          tlsOnly: true,
        })
        .reply(201, {
          id: mockAppId,
          accountId: mockAccountId,
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
      const mockApp = {
        id: mockAppId,
        accountId: mockAccountId,
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
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the app creation endpoint
      nock("https://control.ably.net")
        .post(`/v1/accounts/${mockAccountId}/apps`)
        .reply(201, mockApp);

      const { stdout } = await runCommand(
        ["apps:create", "--name", `"${mockAppName}"`, "--json"],
        import.meta.url,
      );

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty("app");
      expect(result.app).toHaveProperty("id", mockAppId);
      expect(result.app).toHaveProperty("name", mockAppName);
      expect(result).toHaveProperty("success", true);
    });

    it("should use custom access token when provided", async () => {
      const customToken = "custom_access_token";

      // Mock the /me endpoint with custom token
      nock("https://control.ably.net", {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the app creation endpoint
      nock("https://control.ably.net", {
        reqheaders: {
          authorization: `Bearer ${customToken}`,
        },
      })
        .post(`/v1/accounts/${mockAccountId}/apps`)
        .reply(201, {
          id: mockAppId,
          accountId: mockAccountId,
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
      // Mock the /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock the app creation endpoint
      nock("https://control.ably.net")
        .post(`/v1/accounts/${mockAccountId}/apps`)
        .reply(201, {
          id: mockAppId,
          accountId: mockAccountId,
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
        `Automatically switched to app: ${mockAppName} (${mockAppId})`,
      );

      // Verify the config file was updated with the new app
      const configPath = resolve(testConfigDir, "config");
      const configContent = readFileSync(configPath, "utf8");
      expect(configContent).toContain(`currentAppId = "${mockAppId}"`);
      expect(configContent).toContain(`appName = "${mockAppName}"`);
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
      // Mock the /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock forbidden response
      nock("https://control.ably.net")
        .post(`/v1/accounts/${mockAccountId}/apps`)
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
      // Mock the /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock not found response
      nock("https://control.ably.net")
        .post(`/v1/accounts/${mockAccountId}/apps`)
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
      // Mock the /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock server error
      nock("https://control.ably.net")
        .post(`/v1/accounts/${mockAccountId}/apps`)
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
      // Mock the /me endpoint
      nock("https://control.ably.net")
        .get("/v1/me")
        .reply(200, {
          account: { id: mockAccountId, name: "Test Account" },
          user: { email: "test@example.com" },
        });

      // Mock validation error
      nock("https://control.ably.net")
        .post(`/v1/accounts/${mockAccountId}/apps`)
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
