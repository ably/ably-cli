import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createDemoServer,
  type DemoServer,
} from "../../../../../../src/services/ai-transport-demo/lib/server.js";

function createMockChannel() {
  return {
    presence: {
      enter: vi.fn().mockResolvedValue(undefined),
      leave: vi.fn().mockResolvedValue(undefined),
    },
  } as any;
}

describe("server", () => {
  let server: DemoServer | null = null;

  afterEach(async () => {
    if (server) {
      await server.close();
      server = null;
    }
  });

  describe("createDemoServer", () => {
    it("should start a server on an available port", async () => {
      const channel = createMockChannel();
      const onMessage = vi.fn();

      server = await createDemoServer({ channel, onMessage });

      expect(server.port).toBeGreaterThan(0);
      expect(server.url).toBe(`http://localhost:${server.port}`);
    });

    it("should enter presence with the endpoint URL", async () => {
      const channel = createMockChannel();
      const onMessage = vi.fn();

      server = await createDemoServer({ channel, onMessage });

      expect(channel.presence.enter).toHaveBeenCalledWith({
        endpoint: server.url,
      });
    });

    it("should handle POST requests with JSON body", async () => {
      const channel = createMockChannel();
      const onMessage = vi.fn();

      server = await createDemoServer({ channel, onMessage });

      const response = await fetch(server.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Hello" }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ ok: true });
      expect(onMessage).toHaveBeenCalledWith({ message: "Hello" });
    });

    it("should handle POST to /api/chat endpoint", async () => {
      const channel = createMockChannel();
      const onMessage = vi.fn();

      server = await createDemoServer({ channel, onMessage });

      const response = await fetch(`${server.url}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Hello from /api/chat" }),
      });

      expect(response.status).toBe(200);
      expect(onMessage).toHaveBeenCalledWith({
        message: "Hello from /api/chat",
      });
    });

    it("should return 400 for invalid JSON", async () => {
      const channel = createMockChannel();
      const onMessage = vi.fn();

      server = await createDemoServer({ channel, onMessage });

      const response = await fetch(server.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      });

      expect(response.status).toBe(400);
      expect(onMessage).not.toHaveBeenCalled();
    });

    it("should return 404 for unknown routes", async () => {
      const channel = createMockChannel();
      const onMessage = vi.fn();

      server = await createDemoServer({ channel, onMessage });

      const response = await fetch(`${server.url}/unknown`);

      expect(response.status).toBe(404);
    });

    it("should emit log events", async () => {
      const channel = createMockChannel();
      const onMessage = vi.fn();
      const logs: string[] = [];

      server = await createDemoServer({ channel, onMessage });
      server.events.on("log", (msg: string) => logs.push(msg));

      await fetch(server.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Test" }),
      });

      expect(logs.some((l) => l.includes("Received message"))).toBe(true);
    });

    it("should leave presence and stop on close", async () => {
      const channel = createMockChannel();
      const onMessage = vi.fn();

      server = await createDemoServer({ channel, onMessage });
      await server.close();

      expect(channel.presence.leave).toHaveBeenCalled();

      // Server should be stopped — fetch should fail
      await expect(
        fetch(server.url).catch(() => {
          throw new Error("connection refused");
        }),
      ).rejects.toThrow();

      server = null; // Prevent double-close in afterEach
    });

    it("should continue if presence enter fails", async () => {
      const channel = createMockChannel();
      channel.presence.enter.mockRejectedValue(new Error("presence error"));
      const onMessage = vi.fn();

      server = await createDemoServer({ channel, onMessage });

      // Server should still be running despite presence failure
      expect(server.port).toBeGreaterThan(0);
    });
  });
});
