import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import {
  nockControl,
  controlApiCleanup,
} from "../../../helpers/control-api-test-helpers.js";
import { getMockConfigManager } from "../../../helpers/mock-config-manager.js";
import { mockNamespace } from "../../../fixtures/control-api.js";

describe("channel-rule:create alias", () => {
  afterEach(() => {
    controlApiCleanup();
  });

  it("should forward to apps:rules:create and produce the same output", async () => {
    const appId = getMockConfigManager().getCurrentAppId()!;
    nockControl()
      .post(`/v1/apps/${appId}/namespaces`)
      .reply(201, mockNamespace({ id: "test-rule", persisted: true }));

    const { stdout } = await runCommand(
      ["channel-rule:create", "--name=test-rule", "--persisted"],
      import.meta.url,
    );

    expect(stdout).toContain("Channel rule test-rule created.");
  });
});
