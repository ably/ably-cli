/**
 * Fake LLM token generator for AI Transport demos.
 *
 * Produces a ReadableStream of text tokens with realistic pacing.
 * Each demo feature has its own response bank with contextually
 * relevant text. No real LLM is used.
 */

import {
  streamingResponses,
  shortStreamingResponses,
  longStreamingResponses,
} from "./responses/streaming.js";

export interface FakeLLMOptions {
  /** Which demo feature is running (selects response bank). */
  feature: string;
  /** The user's message (for keyword matching). */
  userMessage: string;
  /** Override the base delay between tokens in ms (default 40ms). */
  baseDelayMs?: number;
  /** AbortSignal to cancel generation early. */
  signal?: AbortSignal;
}

/** A single token event from the fake LLM. */
export type FakeLLMEvent =
  | { type: "text-delta"; text: string }
  | { type: "finish" };

/**
 * Tokenize a string into word-level tokens, preserving spaces.
 * Each token is a word followed by a space (except possibly the last).
 */
function tokenize(text: string): string[] {
  const words = text.split(/(\s+)/);
  const tokens: string[] = [];
  for (const word of words) {
    if (word.length > 0) {
      tokens.push(word);
    }
  }

  return tokens;
}

/**
 * Select a response based on the feature and user message.
 */
function selectResponse(feature: string, userMessage: string): string {
  const lower = userMessage.toLowerCase();

  // Check for length hints
  if (lower.includes("short") || lower.includes("brief")) {
    const bank = getShortResponseBank(feature);
    return bank[Math.floor(Math.random() * bank.length)];
  }

  if (lower.includes("long") || lower.includes("detailed")) {
    const bank = getLongResponseBank(feature);
    return bank[Math.floor(Math.random() * bank.length)];
  }

  // Default: pick a random response from the feature bank
  const bank = getResponseBank(feature);
  return bank[Math.floor(Math.random() * bank.length)];
}

function getResponseBank(feature: string): string[] {
  switch (feature) {
    case "streaming":
      return streamingResponses;
    // Future features will have their own banks
    default:
      return streamingResponses;
  }
}

function getShortResponseBank(feature: string): string[] {
  switch (feature) {
    case "streaming":
      return shortStreamingResponses;
    default:
      return shortStreamingResponses;
  }
}

function getLongResponseBank(feature: string): string[] {
  switch (feature) {
    case "streaming":
      return longStreamingResponses;
    default:
      return longStreamingResponses;
  }
}

/**
 * Compute a delay with realistic burstiness.
 * Real LLMs produce tokens in bursts rather than at a uniform rate.
 */
function computeDelay(baseMs: number): number {
  // 70% chance of fast (burst), 30% chance of slower (pause)
  if (Math.random() < 0.7) {
    return baseMs * (0.3 + Math.random() * 0.7); // 30-100% of base
  }

  return baseMs * (1.5 + Math.random() * 2.0); // 150-350% of base (pause)
}

/**
 * Create a ReadableStream of fake LLM events.
 *
 * The stream emits text-delta events (one per token) followed by
 * a single finish event. Tokens are delivered with realistic pacing.
 */
export function createFakeLLMStream(
  options: FakeLLMOptions,
): ReadableStream<FakeLLMEvent> {
  const { feature, userMessage, baseDelayMs = 40, signal } = options;
  const responseText = selectResponse(feature, userMessage);
  const tokens = tokenize(responseText);

  return new ReadableStream<FakeLLMEvent>({
    async start(controller) {
      for (const token of tokens) {
        if (signal?.aborted) {
          controller.close();
          return;
        }

        controller.enqueue({ type: "text-delta", text: token });

        const delay = computeDelay(baseDelayMs);
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, delay);
          if (signal) {
            const onAbort = () => {
              clearTimeout(timer);
              reject(new DOMException("Aborted", "AbortError"));
            };

            signal.addEventListener("abort", onAbort, { once: true });
          }
        }).catch((error: unknown) => {
          if (
            error instanceof DOMException &&
            error.name === "AbortError"
          ) {
            controller.close();
            return;
          }

          throw error;
        });
      }

      controller.enqueue({ type: "finish" });
      controller.close();
    },
  });
}
