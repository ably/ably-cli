import { describe, it, expect, vi } from "vitest";
import {
  DemoCodec,
  type DemoMessage,
} from "../../../../../../src/services/ai-transport-demo/lib/codec.js";
import type { FakeLLMEvent } from "../../../../../../src/services/ai-transport-demo/lib/fake-llm.js";

function createMockChannelWriter() {
  return {
    publish: vi
      .fn()
      .mockResolvedValue({ serial: "01700000000000-000@abc:001" }),
    appendMessage: vi
      .fn()
      .mockResolvedValue({ serial: "01700000000000-000@abc:002" }),
    updateMessage: vi
      .fn()
      .mockResolvedValue({ serial: "01700000000000-000@abc:003" }),
  };
}

describe("DemoCodec", () => {
  describe("isTerminal", () => {
    it("should return true for finish events", () => {
      expect(DemoCodec.isTerminal({ type: "finish" })).toBe(true);
    });

    it("should return false for text-delta events", () => {
      expect(
        DemoCodec.isTerminal({ type: "text-delta", text: "hello" }),
      ).toBe(false);
    });
  });

  describe("getMessageKey", () => {
    it("should return the message id", () => {
      const msg: DemoMessage = {
        id: "msg-123",
        role: "user",
        content: "hello",
      };
      expect(DemoCodec.getMessageKey(msg)).toBe("msg-123");
    });
  });

  describe("createAccumulator", () => {
    it("should start with empty state", () => {
      const acc = DemoCodec.createAccumulator();
      expect(acc.messages).toEqual([]);
      expect(acc.completedMessages).toEqual([]);
      expect(acc.hasActiveStream).toBe(false);
    });

    it("should accumulate text-delta events into a message", () => {
      const acc = DemoCodec.createAccumulator();

      acc.processOutputs([
        {
          kind: "event",
          event: { type: "text-delta", text: "Hello " } as FakeLLMEvent,
          messageId: "stream-1",
        },
        {
          kind: "event",
          event: { type: "text-delta", text: "world" } as FakeLLMEvent,
          messageId: "stream-1",
        },
      ]);

      expect(acc.messages).toHaveLength(1);
      expect(acc.messages[0].content).toBe("Hello world");
      expect(acc.messages[0].role).toBe("assistant");
      expect(acc.hasActiveStream).toBe(true);
    });

    it("should mark message as completed on finish event", () => {
      const acc = DemoCodec.createAccumulator();

      acc.processOutputs([
        {
          kind: "event",
          event: { type: "text-delta", text: "Hi" } as FakeLLMEvent,
          messageId: "stream-1",
        },
      ]);

      expect(acc.hasActiveStream).toBe(true);
      expect(acc.completedMessages).toHaveLength(0);

      acc.processOutputs([
        {
          kind: "event",
          event: { type: "finish" } as FakeLLMEvent,
          messageId: "stream-1",
        },
      ]);

      expect(acc.hasActiveStream).toBe(false);
      expect(acc.completedMessages).toHaveLength(1);
    });

    it("should handle complete message outputs", () => {
      const acc = DemoCodec.createAccumulator();

      acc.processOutputs([
        {
          kind: "message",
          message: { id: "msg-1", role: "user", content: "Hello" },
        },
      ]);

      expect(acc.messages).toHaveLength(1);
      expect(acc.messages[0]).toEqual({
        id: "msg-1",
        role: "user",
        content: "Hello",
      });
      expect(acc.completedMessages).toHaveLength(1);
    });

    it("should update existing messages via updateMessage", () => {
      const acc = DemoCodec.createAccumulator();

      acc.processOutputs([
        {
          kind: "message",
          message: { id: "msg-1", role: "user", content: "Hello" },
        },
      ]);

      acc.updateMessage({ id: "msg-1", role: "user", content: "Updated" });

      expect(acc.messages[0].content).toBe("Updated");
    });
  });

  describe("createEncoder - options forwarding", () => {
    // This test exists to catch a critical bug: if the encoder drops
    // options.extras (transport headers) or options.onMessage, the server's
    // published messages won't carry the turn-correlation headers
    // (x-ably-turn-id, etc.). Without those headers, the client's stream
    // router can't correlate events to active turns, and the ActiveTurn.stream
    // never receives any events. The streaming demo breaks silently.
    it("should forward options.extras.headers to published messages", async () => {
      const channel = createMockChannelWriter();
      const turnHeaders = {
        "x-ably-turn-id": "turn-abc123",
        "x-ably-role": "assistant",
        "x-ably-msg-id": "msg-xyz",
      };

      const encoder = DemoCodec.createEncoder(channel as never, {
        extras: { headers: turnHeaders },
      });

      // Publish a user message — headers must be on the published message
      await encoder.writeMessages([
        { id: "msg-1", role: "user", content: "Hello" },
      ]);

      expect(channel.publish).toHaveBeenCalled();
      const publishCall = channel.publish.mock.calls[0];
      const publishedMsg = publishCall[0];
      const headersOnMsg = Array.isArray(publishedMsg)
        ? publishedMsg[0]?.extras?.headers
        : publishedMsg?.extras?.headers;

      // Verify all turn headers are on the published message
      for (const [key, value] of Object.entries(turnHeaders)) {
        expect(headersOnMsg).toMatchObject({ [key]: value });
      }
    });

    it("should forward options.onMessage hook for pre-publish mutation", async () => {
      const channel = createMockChannelWriter();
      const onMessage = vi.fn();

      const encoder = DemoCodec.createEncoder(channel as never, {
        extras: { headers: { "x-ably-turn-id": "turn-1" } },
        onMessage,
      });

      await encoder.writeMessages([
        { id: "msg-1", role: "user", content: "Hi" },
      ]);

      // onMessage should be called before each publish with the Ably message
      expect(onMessage).toHaveBeenCalled();
    });
  });
});
