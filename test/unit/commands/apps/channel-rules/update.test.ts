import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import {
  nockControl,
  controlApiCleanup,
} from "../../../../helpers/control-api-test-helpers.js";
import { getMockConfigManager } from "../../../../helpers/mock-config-manager.js";

describe("apps:channel-rules:update alias", () => {
  afterEach(() => {
    controlApiCleanup();
  });

  it("should forward to apps:rules:update and produce the same output", async () => {
    const appId = getMockConfigManager().getCurrentAppId()!;
    nockControl()
      .get(`/v1/apps/${appId}/namespaces`)
      .reply(200, [
        {
          id: "chat",
          persisted: false,
          pushEnabled: false,
          created: Date.now(),
          modified: Date.now(),
        },
      ]);

    nockControl().patch(`/v1/apps/${appId}/namespaces/chat`).reply(200, {
      id: "chat",
      persisted: true,
      pushEnabled: false,
      created: Date.now(),
      modified: Date.now(),
    });

    const { stdout } = await runCommand(
      ["apps:channel-rules:update", "chat", "--persisted"],
      import.meta.url,
    );

    expect(stdout).toContain("updated");
    expect(stdout).toContain("Persisted: Yes");
  });
});
