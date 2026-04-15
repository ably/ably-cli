import { describe, it, expect } from "vitest";
import {
  DemoCodec,
  type DemoMessage,
} from "../../../../../../src/services/ai-transport-demo/lib/codec.js";
import type { FakeLLMEvent } from "../../../../../../src/services/ai-transport-demo/lib/fake-llm.js";

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
});
