import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import {
  nockControl,
  controlApiCleanup,
} from "../../../../helpers/control-api-test-helpers.js";
import { getMockConfigManager } from "../../../../helpers/mock-config-manager.js";

describe("apps:channel-rules:create alias", () => {
  afterEach(() => {
    controlApiCleanup();
  });

  it("should forward to apps:rules:create and produce the same output", async () => {
    const appId = getMockConfigManager().getCurrentAppId()!;
    nockControl().post(`/v1/apps/${appId}/namespaces`).reply(201, {
      id: "chat",
      persisted: false,
      pushEnabled: false,
      created: Date.now(),
      modified: Date.now(),
    });

    const { stdout } = await runCommand(
      ["apps:channel-rules:create", "--name", "chat"],
      import.meta.url,
    );

    expect(stdout).toContain("Channel rule chat created.");
  });
});
