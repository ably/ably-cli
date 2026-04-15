/**
 * Demo codec for the AI Transport demo commands.
 *
 * Maps between the demo's domain types (FakeLLMEvent, DemoMessage)
 * and the Ably wire format using the @ably/ai-transport codec helpers.
 */

import {
  createEncoderCore,
  createDecoderCore,
} from "@ably/ai-transport";
import type {
  Codec,
  StreamEncoder,
  StreamDecoder,
  MessageAccumulator,
  DecoderOutput,
  EncoderOptions,
  WriteOptions,
  ChannelWriter,
  DecoderCoreHooks,
  StreamTrackerState,
} from "@ably/ai-transport";
import type * as Ably from "ably";

import type { FakeLLMEvent } from "./fake-llm.js";

/** A message in the demo conversation. */
export interface DemoMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

/** The message name used for assistant text streams on the wire. */
const STREAM_NAME = "assistant-text";

/** The message name used for discrete user messages on the wire. */
const USER_MESSAGE_NAME = "user-message";

// ── Encoder ──────────────────────────────────────────────────────

function createDemoEncoder(
  channel: ChannelWriter,
  options?: EncoderOptions,
): StreamEncoder<FakeLLMEvent, DemoMessage> {
  const core = createEncoderCore(channel, {
    clientId: options?.clientId,
  });
  let activeStreamId: string | null = null;

  return {
    async writeMessages(
      messages: DemoMessage[],
      opts?: WriteOptions,
    ): Promise<Ably.PublishResult> {
      return core.publishDiscreteBatch(
        messages.map((m) => ({
          name: USER_MESSAGE_NAME,
          data: JSON.stringify({ id: m.id, role: m.role, content: m.content }),
        })),
        opts,
      );
    },

    async writeEvent(
      event: FakeLLMEvent,
      opts?: WriteOptions,
    ): Promise<Ably.PublishResult> {
      return core.publishDiscrete(
        {
          name: STREAM_NAME,
          data: JSON.stringify(event),
        },
        opts,
      );
    },

    async appendEvent(event: FakeLLMEvent, opts?: WriteOptions): Promise<void> {
      if (event.type === "text-delta") {
        if (!activeStreamId) {
          // Start a new stream for the first delta
          activeStreamId = `stream-${Date.now()}`;
          await core.startStream(activeStreamId, {
            name: STREAM_NAME,
            data: event.text,
          }, opts);
        } else {
          core.appendStream(activeStreamId, event.text);
        }
      } else if (event.type === "finish") {
        if (activeStreamId) {
          await core.closeStream(activeStreamId, {
            name: STREAM_NAME,
            data: "",
          });
          activeStreamId = null;
        }
      }
    },

    async abort(reason?: string): Promise<void> {
      if (activeStreamId) {
        await core.abortStream(activeStreamId);
        activeStreamId = null;
      } else {
        await core.abortAllStreams();
      }
    },

    async close(): Promise<void> {
      await core.close();
      activeStreamId = null;
    },
  };
}

// ── Decoder ──────────────────────────────────────────────────────

function createDemoDecoder(): StreamDecoder<FakeLLMEvent, DemoMessage> {
  const hooks: DecoderCoreHooks<FakeLLMEvent, DemoMessage> = {
    buildStartEvents(
      tracker: StreamTrackerState,
    ): DecoderOutput<FakeLLMEvent, DemoMessage>[] {
      // Emit a text-delta for the initial data from startStream
      if (tracker.accumulated) {
        return [
          {
            kind: "event",
            event: { type: "text-delta", text: tracker.accumulated },
            messageId: tracker.streamId,
          },
        ];
      }

      return [];
    },

    buildDeltaEvents(
      tracker: StreamTrackerState,
      delta: string,
    ): DecoderOutput<FakeLLMEvent, DemoMessage>[] {
      return [
        {
          kind: "event",
          event: { type: "text-delta", text: delta },
          messageId: tracker.streamId,
        },
      ];
    },

    buildEndEvents(
      tracker: StreamTrackerState,
    ): DecoderOutput<FakeLLMEvent, DemoMessage>[] {
      return [
        {
          kind: "event",
          event: { type: "finish" },
          messageId: tracker.streamId,
        },
        {
          kind: "message",
          message: {
            id: tracker.streamId,
            role: "assistant",
            content: tracker.accumulated,
          },
        },
      ];
    },

    decodeDiscrete(payload): DecoderOutput<FakeLLMEvent, DemoMessage>[] {
      if (payload.name === USER_MESSAGE_NAME) {
        const data = JSON.parse(payload.data as string) as DemoMessage;
        return [{ kind: "message", message: data }];
      }

      return [];
    },
  };

  const core = createDecoderCore<FakeLLMEvent, DemoMessage>(hooks);
  return { decode: (msg) => core.decode(msg) };
}

// ── Accumulator ──────────────────────────────────────────────────

function createDemoAccumulator(): MessageAccumulator<FakeLLMEvent, DemoMessage> {
  const messagesMap = new Map<string, DemoMessage>();
  const activeStreams = new Set<string>();
  const completedIds = new Set<string>();

  return {
    processOutputs(
      outputs: DecoderOutput<FakeLLMEvent, DemoMessage>[],
    ): void {
      for (const output of outputs) {
        if (output.kind === "message") {
          const msg = output.message;
          messagesMap.set(msg.id, msg);
          activeStreams.delete(msg.id);
          completedIds.add(msg.id);
        } else if (output.kind === "event" && output.messageId) {
          const event = output.event;
          if (event.type === "text-delta") {
            const existing = messagesMap.get(output.messageId);
            if (existing) {
              existing.content += event.text;
            } else {
              messagesMap.set(output.messageId, {
                id: output.messageId,
                role: "assistant",
                content: event.text,
              });
              activeStreams.add(output.messageId);
            }
          } else if (event.type === "finish") {
            activeStreams.delete(output.messageId);
            completedIds.add(output.messageId);
          }
        }
      }
    },

    updateMessage(message: DemoMessage): void {
      messagesMap.set(message.id, message);
    },

    get messages(): DemoMessage[] {
      return [...messagesMap.values()];
    },

    get completedMessages(): DemoMessage[] {
      return [...messagesMap.values()].filter((m) => completedIds.has(m.id));
    },

    get hasActiveStream(): boolean {
      return activeStreams.size > 0;
    },
  };
}

// ── Codec ────────────────────────────────────────────────────────

/** The demo codec for AI Transport demos. */
export const DemoCodec: Codec<FakeLLMEvent, DemoMessage> = {
  createEncoder: createDemoEncoder,
  createDecoder: createDemoDecoder,
  createAccumulator: createDemoAccumulator,
  isTerminal: (event: FakeLLMEvent): boolean => event.type === "finish",
  getMessageKey: (message: DemoMessage): string => message.id,
};
