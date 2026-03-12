import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import {
  nockControl,
  controlApiCleanup,
} from "../../../helpers/control-api-test-helpers.js";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";
import { mockNamespace } from "../../../fixtures/control-api.js";

describe("channel-rule:update alias", () => {
  afterEach(() => {
    controlApiCleanup();
  });

  it("should forward to apps:rules:update and produce the same output", async () => {
    const appId = getMockConfigManager().getCurrentAppId()!;
    nockControl()
      .get(`/v1/apps/${appId}/namespaces`)
      .reply(200, [mockNamespace({ id: "test-rule" })]);

    nockControl()
      .patch(`/v1/apps/${appId}/namespaces/test-rule`)
      .reply(200, mockNamespace({ id: "test-rule", persisted: true }));

    const { stdout } = await runCommand(
      ["channel-rule:update", "test-rule", "--persisted"],
      import.meta.url,
    );

    expect(stdout).toContain("updated");
    expect(stdout).toContain("Persisted: Yes");
  });
});
