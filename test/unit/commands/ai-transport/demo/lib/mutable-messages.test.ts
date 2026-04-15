import { describe, it, expect, vi } from "vitest";
import {
  extractNamespace,
  checkViaControlApi,
  checkViaDataPlane,
  enableMutableMessages,
} from "../../../../../../src/commands/ai-transport/demo/lib/mutable-messages.js";
import type { ControlApi } from "../../../../../../src/services/control-api.js";

function createMockControlApi(
  namespaces: Array<{ id: string; mutableMessages?: boolean }>,
): ControlApi {
  return {
    listNamespaces: vi.fn().mockResolvedValue(
      namespaces.map((ns) => ({
        appId: "test-app",
        id: ns.id,
        mutableMessages: ns.mutableMessages,
        persisted: ns.mutableMessages ?? false,
        pushEnabled: false,
        created: Date.now(),
        modified: Date.now(),
      })),
    ),
    createNamespace: vi.fn().mockResolvedValue({}),
    updateNamespace: vi.fn().mockResolvedValue({}),
  } as unknown as ControlApi;
}

function createMockChannel(opts?: {
  publishError?: { code: number };
  appendError?: { code: number };
}) {
  return {
    publish: opts?.publishError
      ? vi.fn().mockRejectedValue(opts.publishError)
      : vi.fn().mockResolvedValue(undefined),
    appendMessage: opts?.appendError
      ? vi.fn().mockRejectedValue(opts.appendError)
      : vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe("mutable-messages", () => {
  describe("extractNamespace", () => {
    it("should extract namespace from channel name with colon", () => {
      expect(extractNamespace("ai-demo:streaming-abc")).toBe("ai-demo");
    });

    it("should return empty string for channel name without colon", () => {
      expect(extractNamespace("streaming-abc")).toBe("");
    });

    it("should handle multiple colons", () => {
      expect(extractNamespace("ai-demo:sub:channel")).toBe("ai-demo");
    });
  });

  describe("checkViaControlApi", () => {
    it("should return enabled when namespace has mutableMessages", async () => {
      const api = createMockControlApi([
        { id: "ai-demo", mutableMessages: true },
      ]);

      const result = await checkViaControlApi(api, "test-app", "ai-demo");

      expect(result).toEqual({ enabled: true, method: "control-api" });
    });

    it("should return not enabled when namespace lacks mutableMessages", async () => {
      const api = createMockControlApi([
        { id: "ai-demo", mutableMessages: false },
      ]);

      const result = await checkViaControlApi(api, "test-app", "ai-demo");

      expect(result).toEqual({ enabled: false, method: "control-api" });
    });

    it("should return not enabled when namespace does not exist", async () => {
      const api = createMockControlApi([]);

      const result = await checkViaControlApi(
        api,
        "test-app",
        "nonexistent",
      );

      expect(result).toEqual({ enabled: false, method: "control-api" });
    });

    it("should return null when Control API fails", async () => {
      const api = {
        listNamespaces: vi.fn().mockRejectedValue(new Error("unauthorized")),
      } as unknown as ControlApi;

      const result = await checkViaControlApi(api, "test-app", "ai-demo");

      expect(result).toBeNull();
    });
  });

  describe("checkViaDataPlane", () => {
    it("should return enabled when appendMessage succeeds", async () => {
      const channel = createMockChannel();

      const result = await checkViaDataPlane(channel);

      expect(result).toEqual({ enabled: true, method: "data-plane" });
      expect(channel.publish).toHaveBeenCalled();
      expect(channel.appendMessage).toHaveBeenCalled();
    });

    it("should return not enabled when appendMessage returns error 93002", async () => {
      const channel = createMockChannel({
        appendError: { code: 93002 },
      });

      const result = await checkViaDataPlane(channel);

      expect(result).toEqual({ enabled: false, method: "data-plane" });
    });

    it("should return enabled for non-93002 errors", async () => {
      const channel = createMockChannel({
        appendError: { code: 40160 },
      });

      const result = await checkViaDataPlane(channel);

      expect(result).toEqual({ enabled: true, method: "data-plane" });
    });

    it("should detect error 93002 on publish itself", async () => {
      const channel = createMockChannel({
        publishError: { code: 93002 },
      });

      const result = await checkViaDataPlane(channel);

      expect(result).toEqual({ enabled: false, method: "data-plane" });
    });
  });

  describe("enableMutableMessages", () => {
    it("should update existing namespace", async () => {
      const api = createMockControlApi([
        { id: "ai-demo", mutableMessages: false },
      ]);

      await enableMutableMessages(api, "test-app", "ai-demo");

      expect(api.updateNamespace).toHaveBeenCalledWith(
        "test-app",
        "ai-demo",
        { mutableMessages: true, persisted: true },
      );
    });

    it("should create new namespace when it does not exist", async () => {
      const api = createMockControlApi([]);

      await enableMutableMessages(api, "test-app", "ai-demo");

      expect(api.createNamespace).toHaveBeenCalledWith("test-app", {
        id: "ai-demo",
        mutableMessages: true,
        persisted: true,
      });
    });
  });
});
