import { describe, it, expect, vi } from "vitest";
import { discoverServer } from "../../../../../../src/services/ai-transport-demo/lib/client-discovery.js";

function createMockChannel(opts?: {
  presenceMembers?: Array<{ data: unknown; clientId?: string; action?: string }>;
}) {
  let subscribeCallback: ((msg: any) => void) | null = null;

  return {
    presence: {
      get: vi
        .fn()
        .mockResolvedValue(
          (opts?.presenceMembers ?? []).map((m) => ({
            ...m,
            action: m.action ?? "present",
          })),
        ),
      subscribe: vi.fn((callback: (msg: any) => void) => {
        subscribeCallback = callback;
      }),
      unsubscribe: vi.fn(),
    },
    // Helper to simulate a presence event
    _simulatePresenceEvent(member: {
      data: unknown;
      clientId?: string;
      action: string;
    }) {
      subscribeCallback?.(member);
    },
  } as any;
}

describe("client-discovery", () => {
  describe("discoverServer", () => {
    it("should find server from existing presence members", async () => {
      const channel = createMockChannel({
        presenceMembers: [
          {
            data: { endpoint: "http://localhost:12345" },
            clientId: "server-1",
          },
        ],
      });

      const result = await discoverServer(channel, 1000);

      expect(result).toEqual({
        endpoint: "http://localhost:12345",
        clientId: "server-1",
      });
    });

    it("should find server when it enters after subscription", async () => {
      const channel = createMockChannel({ presenceMembers: [] });

      // Start discovery, then simulate server entering
      const discoveryPromise = discoverServer(channel, 5000);

      // Small delay to let subscription start
      await new Promise((resolve) => setTimeout(resolve, 10));

      channel._simulatePresenceEvent({
        action: "enter",
        data: { endpoint: "http://localhost:9999" },
        clientId: "server-2",
      });

      const result = await discoveryPromise;

      expect(result).toEqual({
        endpoint: "http://localhost:9999",
        clientId: "server-2",
      });
    });

    it("should return null when no server found within timeout", async () => {
      const channel = createMockChannel({ presenceMembers: [] });

      const result = await discoverServer(channel, 100); // Short timeout

      expect(result).toBeNull();
    });

    it("should ignore presence members without endpoint data", async () => {
      const channel = createMockChannel({
        presenceMembers: [
          { data: { something: "else" }, clientId: "not-a-server" },
        ],
      });

      const result = await discoverServer(channel, 100);

      expect(result).toBeNull();
    });

    it("should ignore non-enter/present actions", async () => {
      const channel = createMockChannel({ presenceMembers: [] });

      const discoveryPromise = discoverServer(channel, 500);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Leave event should be ignored
      channel._simulatePresenceEvent({
        action: "leave",
        data: { endpoint: "http://localhost:9999" },
        clientId: "server-3",
      });

      const result = await discoveryPromise;
      expect(result).toBeNull();
    });

    it("should call onLog callback", async () => {
      const channel = createMockChannel({
        presenceMembers: [
          { data: { endpoint: "http://localhost:12345" } },
        ],
      });
      const logs: string[] = [];

      await discoverServer(channel, 1000, (msg) => logs.push(msg));

      expect(logs.some((l) => l.includes("Searching for server"))).toBe(
        true,
      );
      expect(logs.some((l) => l.includes("Found server"))).toBe(true);
    });

    it("should handle presence.get failure gracefully", async () => {
      const channel = createMockChannel({ presenceMembers: [] });
      channel.presence.get.mockRejectedValue(new Error("not attached"));

      // Should still fall through to subscribe and then timeout
      const result = await discoverServer(channel, 100);
      expect(result).toBeNull();
    });
  });
});
