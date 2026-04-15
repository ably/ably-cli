/**
 * Response bank for the streaming demo.
 * Each response is a string that gets tokenized word-by-word for streaming.
 * These responses are self-aware and reference the streaming infrastructure.
 */

export const streamingResponses: string[] = [
  "Right now, each word you see is traveling as a separate token through Ably's global messaging infrastructure. The server published it to an Ably channel, and your client picked it up in real time via a persistent WebSocket connection. This is fundamentally different from a typical HTTP response body, because the stream lives on the channel, not on the connection. If your connection dropped right now and reconnected, you'd pick up exactly where you left off. That's what makes this a durable transport layer rather than just another streaming API. The tokens persist on the channel, so nothing is lost even if the network blips. Pretty neat for something that looks like a simple chat, right?",

  "Let me tell you about what's happening behind the scenes while I stream this response. The server received your message via an HTTP POST, just like a normal API call. But instead of streaming the response back over that same HTTP connection, it's publishing tokens to an Ably channel. Your client is subscribed to that channel and renders each token as it arrives. This decoupling is the whole point of AI Transport. The response doesn't depend on the HTTP connection staying alive. Multiple clients could subscribe to the same channel and see this response simultaneously. The server doesn't even need to know how many clients are listening.",

  "I'm a fake language model, but I'm streaming through the exact same infrastructure a real one would use. Each token goes through Ably's edge network, which spans over 600 points of presence globally. The median delivery latency is under 50 milliseconds, which is why this feels instantaneous even though every token is making a round trip through the cloud. In production, you'd replace me with Claude, GPT, or any other model, and the transport layer would work identically. The AI Transport SDK handles the protocol, the turn lifecycle, the streaming, and the recovery. Your application code just publishes events and subscribes to them.",

  "Here's something interesting about the architecture you're seeing in action. This demo has a real HTTP server running locally on your machine, and a real Ably channel connecting the server transport to the client transport. The server entered presence on the channel to announce itself, and the client discovered it automatically. When you typed your message, the client POSTed it to the server's HTTP endpoint. The server then started a new turn, began streaming tokens through the AI Transport SDK, and here we are. Every piece of this is the real protocol, exercised end to end. The only fake part is me, the language model.",

  "Welcome to the streaming demo. What you're witnessing is AI Transport's core capability: durable token streaming over Ably channels. Each word I produce is published as a message operation on the channel. The Ably SDK handles message ordering, delivery guarantees, and connection management. If I were a real AI model, I might be generating tokens for thirty seconds or more. During that time, network conditions could change, connections might drop and reconnect, or you might switch devices entirely. The transport layer handles all of that transparently. The stream just keeps flowing, picking up where it left off after any interruption.",
];

/**
 * Short responses for when the user asks for something brief.
 */
export const shortStreamingResponses: string[] = [
  "Short and sweet. Each of these tokens traveled through Ably's infrastructure to reach you. That's AI Transport in action.",
  "Quick response! But every word still went through the full transport pipeline: server published to Ably channel, client subscribed and rendered. Real infrastructure, real protocol.",
  "Brief as requested. Even this short message exercises the full AI Transport stack end to end.",
];

/**
 * Responses for when the user asks for something long.
 */
export const longStreamingResponses: string[] = [
  "You asked for a long response, so let me take this opportunity to really dig into what's happening at every layer of the stack while I stream this to you. Starting at the top: you typed a message and hit enter. The client component captured that input and made an HTTP POST request to the demo server running on localhost. The server received that request, parsed the message body, and created a new turn using the AI Transport SDK's server transport. A turn is the fundamental unit of a request-response cycle in the AI Transport protocol. It has a unique ID, a lifecycle with start and end events, and an abort signal that fires if the client cancels. The server published a turn-start event to the Ably channel, signaling to all subscribers that a response is incoming. Then the server began streaming tokens. Each token is published as a message append operation on the channel. This is where Ably's mutable messages feature comes in. The response message starts as an empty message on the channel, and each token appends to it. The channel maintains the full accumulated state, so if a new client subscribes mid-stream, it receives the complete response so far and then continues receiving live updates. This is what makes the stream resumable. On the client side, the AI Transport SDK's client transport is subscribed to the channel. It decodes each incoming message using the codec, which converts the wire format back into domain events. The React hook in the UI consumes these events and updates the conversation display. The debug console below the conversation shows you the raw transport events as they happen. When I finish this response, the server will publish a turn-end event, and the client will know the response is complete. The whole cycle, from your keypress to this final token, exercised real network infrastructure, real message routing, and real protocol handling. Not bad for a demo running on localhost.",
];
