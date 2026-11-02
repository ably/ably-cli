import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Config } from "@oclif/core";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const TARGET = "target-client-id";

type ClientOptionsReader = {
  getClientOptions(flags: Record<string, unknown>): { clientId?: string };
};

/**
 * Commands such as `push devices remove-where --client-id user123` declare
 * their own --client-id to name a target or filter. Before the identity flag
 * was singled out, that value also became the CLI's own wire identity, which
 * billed an end user who never connected. This guard covers every command,
 * including ones added later.
 */
describe("command-local --client-id flags", () => {
  let config: Config;

  beforeAll(async () => {
    process.env.ABLY_API_KEY = "appId.keyId:keySecret";
    config = await Config.load({ root: projectRoot });
  });

  afterAll(() => {
    delete process.env.ABLY_API_KEY;
  });

  it("never become the client ID the CLI acts as", async () => {
    // oclif loads commands outside the test's module graph, so take the shared
    // identity flag from a command known to declare it rather than importing it.
    const publish = await config.findCommand("channels:publish")!.load();
    const identityFlag = publish.flags["client-id"];

    const targetCommands: string[] = [];
    const leaked: string[] = [];
    for (const command of config.commands) {
      const CommandClass = await command.load();
      // Topic index commands declare no flags at all, despite the static type.
      const flags = CommandClass.flags as Record<string, unknown> | undefined;
      const flag = flags?.["client-id"];
      if (!flag || flag === identityFlag) continue;

      targetCommands.push(command.id);
      const instance = new (CommandClass as unknown as new (
        argv: string[],
        config: Config,
      ) => ClientOptionsReader)([], config);

      const { clientId } = instance.getClientOptions({ "client-id": TARGET });
      if (clientId === TARGET) leaked.push(command.id);
    }

    expect(leaked).toEqual([]);

    // Guards the guard: if this drops to zero the loop above checked nothing.
    expect(targetCommands).toContain("push:devices:remove-where");
  });
});
