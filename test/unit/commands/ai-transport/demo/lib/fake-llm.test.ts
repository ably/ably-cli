import { describe, it, expect } from "vitest";
import {
  createFakeLLMStream,
  type FakeLLMEvent,
} from "../../../../../../src/commands/ai-transport/demo/lib/fake-llm.js";

async function collectEvents(
  stream: ReadableStream<FakeLLMEvent>,
): Promise<FakeLLMEvent[]> {
  const events: FakeLLMEvent[] = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    events.push(value);
  }

  return events;
}

describe("fake-llm", () => {
  describe("createFakeLLMStream", () => {
    it("should produce text-delta events followed by a finish event", async () => {
      const stream = createFakeLLMStream({
        feature: "streaming",
        userMessage: "Hello",
        baseDelayMs: 1, // Fast for tests
      });

      const events = await collectEvents(stream);

      expect(events.length).toBeGreaterThan(1);

      // All events except the last should be text-delta
      const deltas = events.filter((e) => e.type === "text-delta");
      expect(deltas.length).toBeGreaterThan(0);

      // Last event should be finish
      const last = events[events.length - 1];
      expect(last.type).toBe("finish");
    });

    it("should produce non-empty text in deltas", async () => {
      const stream = createFakeLLMStream({
        feature: "streaming",
        userMessage: "Tell me something",
        baseDelayMs: 1,
      });

      const events = await collectEvents(stream);
      const deltas = events.filter(
        (e): e is Extract<FakeLLMEvent, { type: "text-delta" }> =>
          e.type === "text-delta",
      );

      for (const delta of deltas) {
        expect(delta.text.length).toBeGreaterThan(0);
      }
    });

    it("should reconstruct the original response from deltas", async () => {
      const stream = createFakeLLMStream({
        feature: "streaming",
        userMessage: "Hello",
        baseDelayMs: 1,
      });

      const events = await collectEvents(stream);
      const text = events
        .filter(
          (e): e is Extract<FakeLLMEvent, { type: "text-delta" }> =>
            e.type === "text-delta",
        )
        .map((e) => e.text)
        .join("");

      // Should contain meaningful text (not empty)
      expect(text.length).toBeGreaterThan(50);
    });

    it("should select shorter response when user asks for short", async () => {
      const shortStream = createFakeLLMStream({
        feature: "streaming",
        userMessage: "Give me a short response",
        baseDelayMs: 1,
      });

      const normalStream = createFakeLLMStream({
        feature: "streaming",
        userMessage: "Tell me about the weather",
        baseDelayMs: 1,
      });

      const shortEvents = await collectEvents(shortStream);
      const normalEvents = await collectEvents(normalStream);

      const shortDeltas = shortEvents.filter((e) => e.type === "text-delta");
      const normalDeltas = normalEvents.filter(
        (e) => e.type === "text-delta",
      );

      // Short response should have fewer tokens than normal
      expect(shortDeltas.length).toBeLessThan(normalDeltas.length);
    });

    it("should stop when abort signal is fired", async () => {
      const controller = new AbortController();
      const stream = createFakeLLMStream({
        feature: "streaming",
        userMessage: "Tell me something long",
        baseDelayMs: 5,
        signal: controller.signal,
      });

      const events: FakeLLMEvent[] = [];
      const reader = stream.getReader();

      // Read a few events then abort
      for (let i = 0; i < 5; i++) {
        const { done, value } = await reader.read();
        if (done) break;
        events.push(value);
      }

      controller.abort();

      // Read remaining (should stop quickly)
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        events.push(value);
      }

      // Should have stopped before producing all tokens
      // (normal responses have 50+ tokens)
      expect(events.length).toBeLessThan(30);
    });
  });
});
