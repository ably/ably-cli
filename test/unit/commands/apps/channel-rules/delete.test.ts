import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import {
  nockControl,
  controlApiCleanup,
} from "../../../../helpers/control-api-test-helpers.js";
import { getMockConfigManager } from "../../../../helpers/mock-config-manager.js";

describe("apps:channel-rules:delete alias", () => {
  afterEach(() => {
    controlApiCleanup();
  });

  it("should forward to apps:rules:delete and produce the same output", async () => {
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

    nockControl().delete(`/v1/apps/${appId}/namespaces/chat`).reply(204);

    const { stdout } = await runCommand(
      ["apps:channel-rules:delete", "chat", "--force"],
      import.meta.url,
    );

    expect(stdout).toContain("deleted");
  });
});
