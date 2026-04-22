import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  MockedFunction,
} from "vitest";

vi.mock("../../../src/utils/prompt-selection.js", () => ({
  promptForSelection: vi.fn(),
}));

import { promptForSelection } from "../../../src/utils/prompt-selection.js";
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
  let consoleLogSpy: ReturnType<typeof vi.fn>;

  beforeEach(function () {
    // Create stubs and spies
    configManagerStub = {
      listAccounts: vi.fn(),
      getCurrentAccountAlias: vi.fn(),
    };
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
      vi.mocked(promptForSelection).mockResolvedValue(selectedAccount);

      const result = await interactiveHelper.selectAccount();

      expect(result).toBe(selectedAccount);
      expect(promptForSelection).toHaveBeenCalledOnce();
      expect(configManagerStub.listAccounts).toHaveBeenCalledOnce();
      expect(configManagerStub.getCurrentAccountAlias).toHaveBeenCalledOnce();
    });

    it("should handle no configured accounts", async function () {
      configManagerStub.listAccounts.mockReturnValue([]);

      const result = await interactiveHelper.selectAccount();

      expect(result).toBeNull();
      expect(promptForSelection).not.toHaveBeenCalled();
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
      vi.mocked(promptForSelection).mockResolvedValue(selectedApp);

      const result = await interactiveHelper.selectApp(
        controlApiStub as unknown as ControlApi,
      );

      expect(result).toBe(selectedApp);
      expect(promptForSelection).toHaveBeenCalledOnce();
      expect(controlApiStub.listApps).toHaveBeenCalledOnce();
    });

    it("should handle no apps found", async function () {
      controlApiStub.listApps.mockResolvedValue([]);

      const result = await interactiveHelper.selectApp(
        controlApiStub as unknown as ControlApi,
      );

      expect(result).toBeNull();
      expect(promptForSelection).not.toHaveBeenCalled();
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
      vi.mocked(promptForSelection).mockResolvedValue(selectedKey);

      const result = await interactiveHelper.selectKey(
        controlApiStub as unknown as ControlApi,
        "app1",
      );

      expect(result).toBe(selectedKey);
      expect(promptForSelection).toHaveBeenCalledOnce();
      expect(controlApiStub.listKeys).toHaveBeenCalledExactlyOnceWith("app1");
    });

    it("should pass correct choices including unnamed keys", async function () {
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
      vi.mocked(promptForSelection).mockResolvedValue(keys[0]);

      await interactiveHelper.selectKey(
        controlApiStub as unknown as ControlApi,
        "app1",
      );

      // Check that the choices passed to promptForSelection include "Unnamed key"
      const callArgs = vi.mocked(promptForSelection).mock.calls[0];
      const choices = callArgs[1] as Array<{ name: string }>;
      expect(choices[0].name).toContain("Unnamed key");
    });

    it("should handle no keys found", async function () {
      controlApiStub.listKeys.mockResolvedValue([]);

      const result = await interactiveHelper.selectKey(
        controlApiStub as unknown as ControlApi,
        "app1",
      );

      expect(result).toBeNull();
      expect(promptForSelection).not.toHaveBeenCalled();
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
