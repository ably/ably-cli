import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import nock from "nock";
import { Config } from "@oclif/core";

import { ControlBaseCommand } from "../../../src/control-base-command.js";
import {
  ConfigManager,
  TomlConfigManager,
} from "../../../src/services/config-manager.js";
import { BaseFlags } from "../../../src/types/cli.js";

class TestControlCommand extends ControlBaseCommand {
  public testCreateControlApi(flags: BaseFlags) {
    return this.createControlApi(flags);
  }

  public set testConfigManager(value: ConfigManager) {
    this.configManager = value;
  }

  async run(): Promise<void> {
    // No-op
  }
}

describe("ControlBaseCommand", () => {
  let command: TestControlCommand;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    delete process.env.ABLY_ACCESS_TOKEN;

    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue("");
    vi.spyOn(
      TomlConfigManager.prototype as unknown as {
        ensureConfigDirExists: () => void;
      },
      "ensureConfigDirExists",
    ).mockImplementation(() => {});
    vi.spyOn(
      TomlConfigManager.prototype as unknown as {
        saveConfig: () => void;
      },
      "saveConfig",
    ).mockImplementation(() => {});

    command = new TestControlCommand([], {} as Config);
  });

  afterEach(() => {
    process.env = originalEnv;
    nock.cleanAll();
    vi.restoreAllMocks();
  });

  it("uses stored control host for OAuth token refresh when flag is not provided", async () => {
    const customControlHost = "custom.ably.net";
    const configManagerStub = {
      getAccessToken: vi.fn().mockReturnValue("expired_access_token"),
      getAuthMethod: vi.fn().mockReturnValue("oauth"),
      getCurrentAccount: vi.fn().mockReturnValue({
        accessToken: "expired_access_token",
        controlHost: customControlHost,
      }),
      getCurrentAccountAlias: vi.fn().mockReturnValue("default"),
      getOAuthTokens: vi.fn().mockReturnValue({
        accessToken: "expired_access_token",
        expiresAt: Date.now() - 1000,
        refreshToken: "refresh_token",
      }),
      isAccessTokenExpired: vi.fn().mockReturnValue(true),
      storeOAuthTokens: vi.fn(),
    } as unknown as ConfigManager;
    command.testConfigManager = configManagerStub;

    const refreshScope = nock(`https://${customControlHost}`)
      .post("/oauth/token")
      .reply(200, {
        access_token: "refreshed_access_token",
        expires_in: 3600,
        refresh_token: "refreshed_refresh_token",
        token_type: "Bearer",
      });

    nock("https://control.ably.net")
      .matchHeader("authorization", "Bearer refreshed_access_token")
      .get("/v1/me")
      .reply(200, {
        account: { id: "acc-123", name: "Test Account" },
        user: { email: "test@example.com" },
      });

    const controlApi = command.testCreateControlApi({});
    const me = await controlApi.getMe();

    expect(me.account.id).toBe("acc-123");
    expect(refreshScope.isDone()).toBe(true);
    expect(configManagerStub.storeOAuthTokens).toHaveBeenCalled();
  });
});
