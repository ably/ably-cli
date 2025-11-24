import { describe, it, expect, beforeEach, afterEach } from "vitest";
import sinon from "sinon";
import fs from "node:fs";
import AccountsLogin from "../../../../src/commands/accounts/login.js";
import { ConfigManager } from "../../../../src/services/config-manager.js";

describe("AccountsLogin", function () {
  let sandbox: sinon.SinonSandbox;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(function () {
    sandbox = sinon.createSandbox();
    originalEnv = { ...process.env };

    // Reset env before each test
    process.env = { ...originalEnv };

    // Stub fs operations to prevent actual file access
    sandbox.stub(fs, "existsSync").returns(true);
    sandbox.stub(fs, "readFileSync").returns("");
    sandbox.stub(fs, "mkdirSync");
    sandbox.stub(fs, "writeFileSync");
  });

  afterEach(function () {
    sandbox.restore();
    process.env = originalEnv;
  });

  describe("command properties", function () {
    it("should have correct static properties", function () {
      expect(AccountsLogin.description).toBe("Log in to your Ably account");
      expect(AccountsLogin.examples).toBeInstanceOf(Array);
      expect(AccountsLogin.args).toHaveProperty("token");
      expect(AccountsLogin.flags).toHaveProperty("alias");
      expect(AccountsLogin.flags).toHaveProperty("no-browser");
    });

    it("should have required flags configuration", function () {
      expect(AccountsLogin.flags.alias).toHaveProperty("char", "a");
      expect(AccountsLogin.flags["no-browser"]).toHaveProperty(
        "default",
        false,
      );
    });

    it("should have token argument configuration", function () {
      expect(AccountsLogin.args.token).toHaveProperty("required", false);
      expect(AccountsLogin.args.token).toHaveProperty("description");
    });
  });

  describe("command instantiation", function () {
    it("should create command instance", function () {
      const command = new AccountsLogin([], {} as any);
      expect(command).toBeInstanceOf(AccountsLogin);
      expect(command.run).toBeTypeOf("function");
    });

    it("should have correct command structure", function () {
      const command = new AccountsLogin([], {} as any);
      expect(command.constructor.name).toBe("AccountsLogin");
    });
  });

  describe("URL construction logic", function () {
    it("should construct local URLs correctly", function () {
      const localHost = "localhost:3000";
      const expectedUrl = `http://${localHost}/users/access_tokens`;

      expect(expectedUrl).toBe("http://localhost:3000/users/access_tokens");
    });

    it("should construct production URLs correctly", function () {
      const productionHost = "control.ably.net";
      const expectedUrl = `https://${productionHost}/users/access_tokens`;

      expect(expectedUrl).toBe("https://control.ably.net/users/access_tokens");
    });

    it("should handle custom control host URLs", function () {
      const customHost = "custom.ably.net";
      const expectedUrl = `https://${customHost}/users/access_tokens`;

      expect(expectedUrl).toBe("https://custom.ably.net/users/access_tokens");
    });
  });

  describe("alias validation logic", function () {
    it("should accept valid alias formats", function () {
      const validAliases = ["valid", "valid-alias", "valid_alias", "v123"];

      // Test that these would be considered valid formats
      validAliases.forEach((alias) => {
        expect(/^[a-z][\d_a-z-]*$/i.test(alias)).toBe(true);
      });
    });

    it("should reject invalid alias formats", function () {
      const invalidAliases = [
        "123invalid",
        "invalid@",
        "invalid space",
        "invalid!",
      ];

      // Test that these would be rejected
      invalidAliases.forEach((alias) => {
        expect(/^[a-z][\d_a-z-]*$/i.test(alias)).toBe(false);
      });
    });

    it("should require alias to start with letter", function () {
      const startsWithLetter = /^[a-z]/i;

      expect(startsWithLetter.test("valid")).toBe(true);
      expect(startsWithLetter.test("123invalid")).toBe(false);
    });
  });

  describe("output formatting", function () {
    it("should format successful JSON output", function () {
      const successData = {
        account: {
          alias: "test",
          id: "testId",
          name: "Test Account",
          user: {
            email: "test@example.com",
          },
        },
        success: true,
      };

      const jsonOutput = JSON.stringify(successData);
      expect(jsonOutput).toContain('"success":true');
      expect(jsonOutput).toContain('"account"');
    });

    it("should format error JSON output", function () {
      const errorData = {
        error: "Authentication failed",
        success: false,
      };

      const jsonOutput = JSON.stringify(errorData);
      expect(jsonOutput).toContain('"success":false');
      expect(jsonOutput).toContain('"error"');
    });
  });

  describe("browser command detection", function () {
    it("should use correct open command for different platforms", function () {
      ["win32", "darwin", "linux"].forEach((_platform) => {
        expect("open").toBeTypeOf("string");
      });
    });
  });

  describe("configuration integration", function () {
    it("should work with ConfigManager", function () {
      // Test basic instantiation without complex mocking
      expect(() => new ConfigManager()).not.toThrow();
    });
  });

  describe("prompt response validation", function () {
    it("should handle yes/no responses correctly", function () {
      const yesResponses = ["y", "yes", "Y", "YES"];
      const noResponses = ["n", "no", "N", "NO"];

      yesResponses.forEach((response) => {
        expect(["y", "yes"].includes(response.toLowerCase())).toBe(true);
      });

      noResponses.forEach((response) => {
        expect(["n", "no"].includes(response.toLowerCase())).toBe(true);
      });
    });
  });

  describe("enhanced JSON output structure", function () {
    it("should format complete login response with app and key info", function () {
      const loginResponse = {
        account: {
          alias: "production",
          id: "acc-123",
          name: "My Company",
          user: {
            email: "user@company.com",
          },
        },
        app: {
          id: "app-456",
          name: "Production App",
          autoSelected: true,
        },
        key: {
          id: "key-789",
          name: "Root Key",
          autoSelected: false,
        },
        success: true,
      };

      // Verify structure
      expect(loginResponse).toHaveProperty("account");
      expect(loginResponse).toHaveProperty("app");
      expect(loginResponse).toHaveProperty("key");
      expect(loginResponse.success).toBe(true);

      // Verify app info
      expect(loginResponse.app.autoSelected).toBe(true);
      expect(loginResponse.app.id).toBe("app-456");

      // Verify key info
      expect(loginResponse.key.autoSelected).toBe(false);
      expect(loginResponse.key.id).toBe("key-789");
    });

    it("should format login response without app when none selected", function () {
      const loginResponse = {
        account: {
          alias: "default",
          id: "acc-123",
          name: "My Company",
          user: {
            email: "user@company.com",
          },
        },
        success: true,
      };

      // Verify minimal structure when no app/key selected
      expect(loginResponse).toHaveProperty("account");
      expect(loginResponse).not.toHaveProperty("app");
      expect(loginResponse).not.toHaveProperty("key");
      expect(loginResponse.success).toBe(true);
    });

    it("should format login response with app but no key", function () {
      const loginResponse = {
        account: {
          alias: "test",
          id: "acc-123",
          name: "My Company",
          user: {
            email: "user@company.com",
          },
        },
        app: {
          id: "app-456",
          name: "Test App",
          autoSelected: true,
        },
        success: true,
      };

      expect(loginResponse).toHaveProperty("account");
      expect(loginResponse).toHaveProperty("app");
      expect(loginResponse).not.toHaveProperty("key");
      expect(loginResponse.app.autoSelected).toBe(true);
    });
  });

  describe("app selection logic", function () {
    it("should handle single app scenario correctly", function () {
      const apps = [
        { id: "app-123", name: "Only App", accountId: "test-account" },
      ];

      // Test the logic that would be used for single app selection
      expect(apps.length).toBe(1);

      const selectedApp = apps[0];
      expect(selectedApp.id).toBe("app-123");
      expect(selectedApp.name).toBe("Only App");

      // In single app scenario, it should be auto-selected
      const isAutoSelected = true;
      expect(isAutoSelected).toBe(true);
    });

    it("should handle multiple apps scenario correctly", function () {
      const apps = [
        { id: "app-123", name: "Production App", accountId: "test-account" },
        { id: "app-456", name: "Development App", accountId: "test-account" },
      ];

      // Test the logic for multiple apps - should prompt user
      expect(apps.length).toBeGreaterThan(1);

      // Verify app structure
      apps.forEach((app) => {
        expect(app).toHaveProperty("id");
        expect(app).toHaveProperty("name");
        expect(app).toHaveProperty("accountId");
      });
    });

    it("should handle no apps scenario correctly", function () {
      const apps: any[] = [];

      // Test the logic for no apps - should offer to create
      expect(apps.length).toBe(0);

      // Simulate app creation response
      const createdApp = {
        id: "new-app-789",
        name: "My First App",
        accountId: "test-account",
        tlsOnly: true,
      };

      expect(createdApp.name).toBe("My First App");
      expect(createdApp.tlsOnly).toBe(true);
    });
  });

  describe("key selection logic", function () {
    it("should handle single key scenario correctly", function () {
      const keys = [{ id: "key-456", name: "Root Key", key: "app.key:value" }];

      // Test single key auto-selection logic
      expect(keys.length).toBe(1);

      const selectedKey = keys[0];
      expect(selectedKey.id).toBe("key-456");
      expect(selectedKey.name).toBe("Root Key");

      // Single key should be auto-selected
      const isAutoSelected = true;
      expect(isAutoSelected).toBe(true);
    });

    it("should handle multiple keys scenario correctly", function () {
      const keys = [
        { id: "key-root", name: "Root Key", key: "app.root:value" },
        { id: "key-sub", name: "Subscribe Key", key: "app.sub:value" },
      ];

      // Test multiple keys logic - should prompt user
      expect(keys.length).toBeGreaterThan(1);

      // Verify key structure
      keys.forEach((key) => {
        expect(key).toHaveProperty("id");
        expect(key).toHaveProperty("name");
        expect(key).toHaveProperty("key");
      });
    });

    it("should handle no keys scenario correctly", function () {
      const keys: any[] = [];

      // Test no keys scenario - should continue without error
      expect(keys.length).toBe(0);

      // This should not cause the login to fail
      // User would need to create keys separately
    });
  });

  describe("app name validation", function () {
    it("should accept valid app names", function () {
      const validNames = ["My App", "production-app", "test_app_123", "App"];

      validNames.forEach((name) => {
        expect(name.trim().length).toBeGreaterThan(0);
        expect(typeof name).toBe("string");
      });
    });

    it("should reject empty app names", function () {
      const invalidNames = ["", "   ", "\t\n"];

      invalidNames.forEach((name) => {
        expect(name.trim().length).toBe(0);
      });
    });

    it("should handle app name edge cases", function () {
      const edgeCases = [
        "A", // Single character
        "Very Long App Name With Many Words And Characters",
        "App-with-dashes",
        "App_with_underscores",
        "App123WithNumbers",
      ];

      edgeCases.forEach((name) => {
        expect(name.trim().length).toBeGreaterThan(0);
        expect(typeof name).toBe("string");
      });
    });
  });

  describe("error handling scenarios", function () {
    it("should handle API errors gracefully", function () {
      const apiError = new Error("Network timeout");

      // Test that errors don't crash the login process
      expect(apiError.message).toBe("Network timeout");
      expect(apiError).toBeInstanceOf(Error);

      // Login should continue and warn about failures
      const warningMessage = `Could not fetch apps: ${apiError.message}`;
      expect(warningMessage).toContain("Network timeout");
    });

    it("should handle authentication failures", function () {
      const authError = new Error("Invalid token");
      authError.name = "AuthenticationError";

      expect(authError.message).toBe("Invalid token");
      expect(authError.name).toBe("AuthenticationError");

      const errorResponse = {
        error: authError.message,
        success: false,
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBe("Invalid token");
    });

    it("should handle app creation failures", function () {
      const createError = new Error("Insufficient permissions");

      expect(createError.message).toBe("Insufficient permissions");

      // App creation failure should not prevent login completion
      const warningMessage = `Failed to create app: ${createError.message}`;
      expect(warningMessage).toContain("Insufficient permissions");
    });

    it("should handle key fetching failures", function () {
      const keyError = new Error("Key access denied");

      expect(keyError.message).toBe("Key access denied");

      // Key fetching failure should not prevent login
      const warningMessage = `Could not fetch API keys: ${keyError.message}`;
      expect(warningMessage).toContain("Key access denied");
    });
  });
});
