import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Config } from "@oclif/core";
import jwt from "jsonwebtoken";

import { AblyBaseCommand } from "../../../src/base-command.js";
import { clientIdFlag } from "../../../src/flags.js";
import {
  CLIENT_ID_ENV_VAR,
  readTokenIdentity,
  resolveClientIdentity,
} from "../../../src/services/client-identity.js";
import { BaseFlags } from "../../../src/types/cli.js";
import {
  MOCK_DEFAULT_CLIENT_ID,
  getMockConfigManager,
} from "../../helpers/mock-config-manager.js";

class TestCommand extends AblyBaseCommand {
  static override flags = { ...clientIdFlag };

  async run(): Promise<void> {}

  public testGetClientOptions(flags: BaseFlags) {
    return this.getClientOptions(flags);
  }
}

class SuffixedCommand extends TestCommand {
  protected override suffixClientIdPerProcess = true;
}

function newCommand(Command = TestCommand): TestCommand {
  return new Command([], { runHook: vi.fn() } as unknown as Config);
}

const API_KEY = "appId.keyId:keySecret";

function signJwt(claims: Record<string, unknown>): string {
  return jwt.sign(claims, "keySecret", {
    algorithm: "HS256",
    keyid: "appId.keyId",
  });
}

describe("client identity", () => {
  beforeEach(() => {
    process.env.ABLY_API_KEY = API_KEY;
  });

  afterEach(() => {
    delete process.env.ABLY_API_KEY;
    delete process.env.ABLY_TOKEN;
    delete process.env[CLIENT_ID_ENV_VAR];
  });

  describe("resolveClientIdentity", () => {
    it("uses the generated install default when nothing is set", () => {
      expect(resolveClientIdentity(undefined, getMockConfigManager())).toEqual({
        clientId: MOCK_DEFAULT_CLIENT_ID,
        source: "default",
        optedOut: false,
      });
    });

    it("prefers the config setting over the generated default", () => {
      const config = getMockConfigManager();
      config.getConfig().client = { id: "configured" };
      expect(resolveClientIdentity(undefined, config).clientId).toBe(
        "configured",
      );
    });

    it("prefers ABLY_CLIENT_ID over the config setting", () => {
      const config = getMockConfigManager();
      config.getConfig().client = { id: "configured" };
      process.env[CLIENT_ID_ENV_VAR] = "from-env";
      expect(resolveClientIdentity(undefined, config)).toMatchObject({
        clientId: "from-env",
        source: "env",
      });
    });

    it("prefers an explicit flag over everything else", () => {
      process.env[CLIENT_ID_ENV_VAR] = "from-env";
      expect(
        resolveClientIdentity("from-flag", getMockConfigManager()),
      ).toMatchObject({ clientId: "from-flag", source: "flag" });
    });

    it("resolves the default once per process", () => {
      const config = getMockConfigManager();
      const first = resolveClientIdentity(undefined, config);
      process.env[CLIENT_ID_ENV_VAR] = "changed-later";
      expect(resolveClientIdentity(undefined, config)).toBe(first);
    });

    it("treats 'none' as an opt-out", () => {
      expect(
        resolveClientIdentity("none", getMockConfigManager()),
      ).toMatchObject({ clientId: undefined, optedOut: true });
    });

    it.each(["", "  ", "*"])("rejects %j", (value) => {
      expect(() =>
        resolveClientIdentity(value, getMockConfigManager()),
      ).toThrow(/--client-id/);
    });

    it("names ABLY_CLIENT_ID when the env var is invalid", () => {
      process.env[CLIENT_ID_ENV_VAR] = "*";
      expect(() =>
        resolveClientIdentity(undefined, getMockConfigManager()),
      ).toThrow(/ABLY_CLIENT_ID/);
    });
  });

  describe("readTokenIdentity", () => {
    it("reads the client ID claim from a JWT", () => {
      expect(
        readTokenIdentity(signJwt({ "x-ably-clientId": "alice" })),
      ).toEqual({ kind: "jwt", clientId: "alice" });
    });

    it("reports a JWT without a client ID", () => {
      expect(readTokenIdentity(signJwt({}))).toEqual({
        kind: "jwt",
        clientId: undefined,
      });
    });

    it("treats a native Ably token as opaque", () => {
      expect(readTokenIdentity("xVLyHw.opaque")).toEqual({ kind: "opaque" });
    });
  });

  describe("getClientOptions", () => {
    it("acts as the stable default client ID", () => {
      const first = newCommand().testGetClientOptions({});
      const second = newCommand().testGetClientOptions({});
      expect(first.clientId).toBe(MOCK_DEFAULT_CLIENT_ID);
      expect(second.clientId).toBe(MOCK_DEFAULT_CLIENT_ID);
    });

    it("acts as ABLY_CLIENT_ID when set", () => {
      process.env[CLIENT_ID_ENV_VAR] = "deploy-bot";
      expect(newCommand().testGetClientOptions({}).clientId).toBe("deploy-bot");
    });

    it("acts as an explicit --client-id", () => {
      expect(
        newCommand().testGetClientOptions({ "client-id": "alice" }).clientId,
      ).toBe("alice");
    });

    it("omits the client ID and warns for the deprecated 'none'", () => {
      const command = newCommand();
      const stderr = vi
        .spyOn(command as unknown as { logToStderr: () => void }, "logToStderr")
        .mockImplementation(() => {});

      const options = command.testGetClientOptions({ "client-id": "none" });

      expect(options.clientId).toBeUndefined();
      expect(stderr).toHaveBeenCalledWith(
        expect.stringContaining("deprecated"),
      );
    });

    it.each(["", "*"])("fails for --client-id %j", (value) => {
      expect(() =>
        newCommand().testGetClientOptions({ "client-id": value }),
      ).toThrow(/--client-id/);
    });

    it("suffixes the default per process when the command asks", () => {
      const options = newCommand(SuffixedCommand).testGetClientOptions({});
      expect(options.clientId).toMatch(
        new RegExp(`^${MOCK_DEFAULT_CLIENT_ID}-[0-9a-f]{8}$`),
      );
    });

    it("never suffixes an explicit --client-id", () => {
      expect(
        newCommand(SuffixedCommand).testGetClientOptions({
          "client-id": "alice",
        }).clientId,
      ).toBe("alice");
    });

    it("never sets a client ID over a token's", () => {
      process.env.ABLY_TOKEN = signJwt({ "x-ably-clientId": "alice" });
      expect(newCommand().testGetClientOptions({}).clientId).toBeUndefined();
    });

    it("fails for a JWT without a client ID", () => {
      process.env.ABLY_TOKEN = signJwt({});
      expect(() => newCommand().testGetClientOptions({})).toThrow(
        /x-ably-clientId/,
      );
    });

    it("accepts an opaque native token", () => {
      process.env.ABLY_TOKEN = "xVLyHw.opaque";
      expect(newCommand().testGetClientOptions({}).token).toBe("xVLyHw.opaque");
    });
  });
});
