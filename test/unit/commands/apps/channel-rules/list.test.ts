import { describe, it, expect, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import nock from "nock";
import { DEFAULT_TEST_CONFIG } from "../../../../helpers/mock-config-manager.js";

describe("apps:channel-rules:list command", () => {
  const mockAppId = DEFAULT_TEST_CONFIG.appId;

  afterEach(() => {
    nock.cleanAll();
  });

  describe("successful channel rules listing", () => {
    it("should list channel rules successfully", async () => {
      const mockRules = [
        {
          id: "chat",
          persisted: true,
          pushEnabled: false,
          created: Date.now(),
          modified: Date.now(),
        },
        {
          id: "events",
          persisted: false,
          pushEnabled: true,
          created: Date.now(),
          modified: Date.now(),
        },
      ];

      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/namespaces`)
        .reply(200, mockRules);

      const { stdout } = await runCommand(
        ["apps:channel-rules:list"],
        import.meta.url,
      );

      expect(stdout).toContain("Found 2 channel rules");
      expect(stdout).toContain("chat");
      expect(stdout).toContain("events");
    });

    it("should handle empty rules list", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/namespaces`)
        .reply(200, []);

      const { stdout } = await runCommand(
        ["apps:channel-rules:list"],
        import.meta.url,
      );

      expect(stdout).toContain("No channel rules found");
    });

    it("should display rule details correctly", async () => {
      const mockRules = [
        {
          id: "chat",
          persisted: true,
          pushEnabled: true,
          authenticated: true,
          tlsOnly: true,
          created: Date.now(),
          modified: Date.now(),
        },
      ];

      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/namespaces`)
        .reply(200, mockRules);

      const { stdout } = await runCommand(
        ["apps:channel-rules:list"],
        import.meta.url,
      );

      expect(stdout).toContain("Found 1 channel rules");
      expect(stdout).toContain("chat");
      expect(stdout).toContain("Persisted: ✓ Yes");
      expect(stdout).toContain("Push Enabled: ✓ Yes");
    });
  });

  describe("error handling", () => {
    it("should handle 401 authentication error", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/namespaces`)
        .reply(401, { error: "Unauthorized" });

      const { error } = await runCommand(
        ["apps:channel-rules:list"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/401/);
    });

    it("should handle 404 not found error", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/namespaces`)
        .reply(404, { error: "App not found" });

      const { error } = await runCommand(
        ["apps:channel-rules:list"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/404/);
    });

    it("should handle network errors", async () => {
      nock("https://control.ably.net")
        .get(`/v1/apps/${mockAppId}/namespaces`)
        .replyWithError("Network error");

      const { error } = await runCommand(
        ["apps:channel-rules:list"],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error!.message).toMatch(/Network error/);
    });
  });
});
