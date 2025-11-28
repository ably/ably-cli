import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  MockedFunction,
} from "vitest";
import inquirer from "inquirer";
import { InteractiveHelper } from "../../../src/services/interactive-helper.js";
import { ConfigManager } from "../../../src/services/config-manager.js";
import { ControlApi, App, Key } from "../../../src/services/control-api.js";

describe("InteractiveHelper", function () {
  let interactiveHelper: InteractiveHelper;
  let configManagerStub: Partial<ConfigManager> & {
    listAccounts: MockedFunction<ConfigManager["listAccounts"]>;
    getCurrentAccountAlias: MockedFunction<
      ConfigManager["getCurrentAccountAlias"]
    >;
  };
  let promptStub: ReturnType<typeof vi.fn>;
  let consoleLogSpy: ReturnType<typeof vi.fn>;
  beforeEach(function () {
    // Create stubs and spies
    configManagerStub = {
      listAccounts: vi.fn(),
      getCurrentAccountAlias: vi.fn(),
    };
    promptStub = vi.spyOn(inquirer, "prompt");
    consoleLogSpy = vi.spyOn(console, "log");

    // Create fresh instance for each test
    interactiveHelper = new InteractiveHelper(
      configManagerStub as unknown as ConfigManager,
      {
        logErrors: false,
      },
    );
  });

  afterEach(function () {
    vi.restoreAllMocks();
  });

  describe("#confirm", function () {
    it("should return true when user confirms", async function () {
      promptStub.mockResolvedValue({ confirmed: true });

      const result = await interactiveHelper.confirm("Confirm this action?");

      expect(result).toBe(true);
      expect(promptStub).toHaveBeenCalledOnce();
      expect(promptStub.mock.calls[0][0][0].message).toBe(
        "Confirm this action?",
      );
    });

    it("should return false when user denies", async function () {
      promptStub.mockResolvedValue({ confirmed: false });

      const result = await interactiveHelper.confirm("Confirm this action?");

      expect(result).toBe(false);
      expect(promptStub).toHaveBeenCalledOnce();
    });
  });

  describe("#selectAccount", function () {
    it("should return selected account", async function () {
      const accounts = [
        {
          alias: "default",
          account: {
            accessToken: "token1",
            accountName: "Account 1",
            userEmail: "user1@example.com",
          },
        },
        {
          alias: "secondary",
          account: {
            accessToken: "token2",
            accountName: "Account 2",
            userEmail: "user2@example.com",
          },
        },
      ];

      configManagerStub.listAccounts.mockReturnValue(accounts);
      configManagerStub.getCurrentAccountAlias.mockReturnValue("default");

      const selectedAccount = accounts[1];
      promptStub.mockResolvedValue({ selectedAccount });

      const result = await interactiveHelper.selectAccount();

      expect(result).toBe(selectedAccount);
      expect(promptStub).toHaveBeenCalledOnce();
      expect(configManagerStub.listAccounts).toHaveBeenCalledOnce();
      expect(configManagerStub.getCurrentAccountAlias).toHaveBeenCalledOnce();
    });

    it("should handle no configured accounts", async function () {
      configManagerStub.listAccounts.mockReturnValue([]);

      const result = await interactiveHelper.selectAccount();

      expect(result).toBeNull();
      expect(promptStub).not.toHaveBeenCalled();
      expect(
        consoleLogSpy.mock.calls.some((call) =>
          /No accounts configured/.test(call[0]),
        ),
      ).toBe(true);
    });

    it("should handle errors", async function () {
      configManagerStub.listAccounts.mockImplementation(() => {
        throw new Error("Test error");
      });

      const result = await interactiveHelper.selectAccount();

      expect(result).toBeNull();
    });
  });

  describe("#selectApp", function () {
    let controlApiStub: Partial<ControlApi> & {
      listApps: MockedFunction<ControlApi["listApps"]>;
    };

    beforeEach(function () {
      controlApiStub = {
        listApps: vi.fn(),
      };
    });

    it("should return selected app", async function () {
      const apps: App[] = [
        {
          id: "app1",
          name: "App 1",
          accountId: "account1",
          created: 1234567890,
          modified: 1234567890,
          status: "active",
          tlsOnly: false,
        },
        {
          id: "app2",
          name: "App 2",
          accountId: "account1",
          created: 1234567890,
          modified: 1234567890,
          status: "active",
          tlsOnly: false,
        },
      ];

      controlApiStub.listApps.mockResolvedValue(apps);

      const selectedApp = apps[1];
      promptStub.mockResolvedValue({ selectedApp });

      const result = await interactiveHelper.selectApp(
        controlApiStub as unknown as ControlApi,
      );

      expect(result).toBe(selectedApp);
      expect(promptStub).toHaveBeenCalledOnce();
      expect(controlApiStub.listApps).toHaveBeenCalledOnce();
    });

    it("should handle no apps found", async function () {
      controlApiStub.listApps.mockResolvedValue([]);

      const result = await interactiveHelper.selectApp(
        controlApiStub as unknown as ControlApi,
      );

      expect(result).toBeNull();
      expect(promptStub).not.toHaveBeenCalled();
      expect(
        consoleLogSpy.mock.calls.some((call) => /No apps found/.test(call[0])),
      ).toBe(true);
    });

    it("should handle errors", async function () {
      controlApiStub.listApps.mockRejectedValue(new Error("Test error"));

      const result = await interactiveHelper.selectApp(
        controlApiStub as unknown as ControlApi,
      );

      expect(result).toBeNull();
    });
  });

  describe("#selectKey", function () {
    let controlApiStub: {
      listKeys: MockedFunction<ControlApi["listKeys"]>;
    };

    beforeEach(function () {
      controlApiStub = {
        listKeys: vi.fn(),
      };
    });

    it("should return selected key", async function () {
      const keys: Key[] = [
        {
          id: "key1",
          name: "Key 1",
          key: "app1.key1:secret1",
          appId: "app1",
          capability: {},
          created: 1234567890,
          modified: 1234567890,
          revocable: true,
          status: "active",
        },
        {
          id: "key2",
          name: "Key 2",
          key: "app1.key2:secret2",
          appId: "app1",
          capability: {},
          created: 1234567890,
          modified: 1234567890,
          revocable: true,
          status: "active",
        },
      ];

      controlApiStub.listKeys.mockResolvedValue(keys);

      const selectedKey = keys[1];
      promptStub.mockResolvedValue({ selectedKey });

      const result = await interactiveHelper.selectKey(
        controlApiStub as unknown as ControlApi,
        "app1",
      );

      expect(result).toBe(selectedKey);
      expect(promptStub).toHaveBeenCalledOnce();
      expect(controlApiStub.listKeys).toHaveBeenCalledExactlyOnceWith("app1");
    });

    it("should handle unnamed keys", async function () {
      const keys: Key[] = [
        {
          id: "key1",
          key: "app1.key1:secret1",
          appId: "app1",
          capability: {},
          created: 1234567890,
          modified: 1234567890,
          name: "",
          revocable: true,
          status: "active",
        },
        {
          id: "key2",
          name: "Key 2",
          key: "app1.key2:secret2",
          appId: "app1",
          capability: {},
          created: 1234567890,
          modified: 1234567890,
          revocable: true,
          status: "active",
        },
      ];

      controlApiStub.listKeys.mockResolvedValue(keys);
      promptStub.mockResolvedValue({ selectedKey: keys[0] });

      await interactiveHelper.selectKey(
        controlApiStub as unknown as ControlApi,
        "app1",
      );

      // Check that the prompt choices include "Unnamed key" for the first key
      const choices = promptStub.mock.calls[0][0][0].choices;
      expect(choices[0].name).toContain("Unnamed key");
    });

    it("should handle no keys found", async function () {
      controlApiStub.listKeys.mockResolvedValue([]);

      const result = await interactiveHelper.selectKey(
        controlApiStub as unknown as ControlApi,
        "app1",
      );

      expect(result).toBeNull();
      expect(promptStub).not.toHaveBeenCalled();
      expect(
        consoleLogSpy.mock.calls.some((call) => /No keys found/.test(call[0])),
      ).toBe(true);
    });

    it("should handle errors", async function () {
      controlApiStub.listKeys.mockRejectedValue(new Error("Test error"));

      const result = await interactiveHelper.selectKey(
        controlApiStub as unknown as ControlApi,
        "app1",
      );

      expect(result).toBeNull();
    });
  });
});
