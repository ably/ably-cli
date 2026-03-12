import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import {
  nockControl,
  controlApiCleanup,
} from "../../../helpers/control-api-test-helpers.js";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";
import { mockNamespace } from "../../../fixtures/control-api.js";

describe("channel-rule:list alias", () => {
  afterEach(() => {
    controlApiCleanup();
  });

  it("should forward to apps:rules:list and produce the same output", async () => {
    const appId = getMockConfigManager().getCurrentAppId()!;
    nockControl()
      .get(`/v1/apps/${appId}/namespaces`)
      .reply(200, [mockNamespace({ id: "rule1", persisted: true })]);

    const { stdout } = await runCommand(["channel-rule:list"], import.meta.url);

    expect(stdout).toContain("Found 1 channel rule");
    expect(stdout).toContain("rule1");
  });
});
