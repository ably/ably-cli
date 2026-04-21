/**
 * Client panel — the conversation area showing user messages and agent responses.
 * Header, debug, and input are handled by App; this is just the message list.
 */

import React from "react";
import { Box, Text } from "ink";
import { colors } from "./theme.js";

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  interrupted?: boolean;
}

interface ClientPanelProps {
  messages: ConversationMessage[];
  serverStatus: "connecting" | "connected" | "not-found";
  isStreaming: boolean;
  /** Total lines available inside the conversation box. */
  maxLines: number;
  /** Approximate usable character width inside the panel (for wrap estimation). */
  contentWidth: number;
  /** Lines scrolled up from the bottom (0 = follow latest). */
  scrollOffsetLines: number;
}

interface WindowSlice {
  msg: ConversationMessage;
  displayContent: string;
  headEllipsis: boolean;
  tailEllipsis: boolean;
  /** True if this is the first slice in the viewport (no top margin). */
  isFirst: boolean;
}

export function ClientPanel({
  messages,
  serverStatus,
  isStreaming,
  maxLines,
  contentWidth,
  scrollOffsetLines,
}: ClientPanelProps) {
  // Compute the visible window: walk messages, find those whose line ranges
  // intersect the viewport, and head/tail-crop content as needed so that
  // any scroll position (top of history, middle, live at the bottom) shows
  // the right slice of content.
  const { slices, totalLines } = selectWindow(
    messages,
    maxLines,
    contentWidth,
    scrollOffsetLines,
  );
  const linesBelowViewport = scrollOffsetLines;
  const hasMoreBelow = linesBelowViewport > 0;
  const linesAboveViewport = Math.max(
    0,
    totalLines - scrollOffsetLines - maxLines,
  );
  const hasMoreAbove = linesAboveViewport > 0;

  return (
    <Box flexDirection="column" flexGrow={1}>
      {serverStatus === "not-found" && (
        <Text color={colors.warning}>
          ⚠ No server detected. Start a server or use --endpoint.
        </Text>
      )}
      {serverStatus === "connecting" && (
        <Text color={colors.dim}>Connecting to server...</Text>
      )}

      {messages.length === 0 &&
        serverStatus === "connected" &&
        !isStreaming && (
          <Text color={colors.dim}>
            Type a message below to start the demo.
          </Text>
        )}

      {hasMoreBelow && (
        <Text color={colors.dim}>
          ↓ {linesBelowViewport} line{linesBelowViewport === 1 ? "" : "s"} below
          {" · "}End to jump to live
        </Text>
      )}
      {slices.map((slice) => {
        const { msg, displayContent, headEllipsis, tailEllipsis, isFirst } =
          slice;
        const content =
          (headEllipsis ? "…" : "") +
          displayContent +
          (tailEllipsis ? "…" : "");
        return (
          <Box key={msg.id} flexDirection="column" marginTop={isFirst ? 0 : 1}>
            {msg.role === "user" ? (
              <Text>
                <Text color={colors.user} bold>
                  You:{" "}
                </Text>
                <Text>{content}</Text>
              </Text>
            ) : (
              <Text>
                <Text color={colors.primary} bold>
                  Agent:{" "}
                </Text>
                <Text color={colors.assistant}>
                  {content}
                  {msg.streaming && !tailEllipsis && (
                    <Text color={colors.dim}>▊</Text>
                  )}
                  {msg.interrupted && (
                    <Text color={colors.warning}> [interrupted]</Text>
                  )}
                </Text>
              </Text>
            )}
          </Box>
        );
      })}
      {hasMoreAbove && (
        <Text color={colors.dim}>
          ↑ {linesAboveViewport} line{linesAboveViewport === 1 ? "" : "s"} above
        </Text>
      )}
    </Box>
  );
}

/**
 * Word-boundary wrapping leaves gaps at line ends — a line rarely fills to
 * the terminal width. Scale the effective width down so our line-count
 * estimates match what Ink actually renders and we don't overshoot the
 * height budget.
 */
const WRAP_EFFICIENCY = 0.85;

function effectiveWidth(contentWidth: number): number {
  return Math.max(1, Math.floor(contentWidth * WRAP_EFFICIENCY));
}

/**
 * Total rendered-line count for the whole conversation. Used by App.tsx
 * to clamp the scroll offset and to maintain scroll position as content
 * grows during streaming.
 */
export function totalRenderedLines(
  messages: ConversationMessage[],
  contentWidth: number,
): number {
  let total = 0;
  for (let i = 0; i < messages.length; i++) {
    const separator = i > 0 ? 1 : 0;
    total += estimateMessageLines(messages[i], contentWidth) + separator;
  }
  return total;
}

/**
 * Slice the conversation to the lines currently inside the scrollable
 * viewport. Handles both head- and tail-crop independently: when the user
 * scrolls to the top of the history, the *first* message should show its
 * beginning; when the user is at the live bottom, the newest message
 * shows its end (streaming tail).
 *
 * offset = 0 means the viewport sits against the bottom of the content.
 * offset = maxScrollable means the viewport sits against the top.
 */
function selectWindow(
  messages: ConversationMessage[],
  maxLines: number,
  contentWidth: number,
  offset: number,
): { slices: WindowSlice[]; totalLines: number } {
  const effWidth = effectiveWidth(contentWidth);
  if (messages.length === 0 || maxLines <= 0) {
    return { slices: [], totalLines: 0 };
  }

  // Absolute line positions (from top of the virtual conversation).
  type Position = { top: number; bottom: number };
  const positions: Position[] = [];
  let cursor = 0;
  for (let i = 0; i < messages.length; i++) {
    const sep = i > 0 ? 1 : 0;
    cursor += sep;
    const top = cursor;
    const msgLines = estimateMessageLines(messages[i], contentWidth);
    cursor += msgLines;
    positions.push({ top, bottom: cursor });
  }
  const totalLines = cursor;

  // Viewport in absolute line coordinates. `offset` is measured from the
  // bottom so offset=0 → viewport flush with bottom.
  const windowBottom = totalLines - offset;
  const windowTop = windowBottom - maxLines;

  const slices: WindowSlice[] = [];
  for (let i = 0; i < messages.length; i++) {
    const { top, bottom } = positions[i];
    // Entirely above the viewport (older content scrolled off the top)
    if (bottom <= windowTop) continue;
    // Entirely below the viewport (newer content scrolled off the bottom)
    if (top >= windowBottom) break;

    const linesAbove = Math.max(0, windowTop - top);
    const linesBelow = Math.max(0, bottom - windowBottom);
    const rolePrefixLen = messages[i].role === "user" ? 5 : 7;

    let displayContent = messages[i].content;

    // Head-crop: the first `linesAbove` display lines of this message are
    // above the viewport. The very first line carries the role prefix
    // ("You: ") so subtract that from the first line's char budget.
    if (linesAbove > 0) {
      const skipChars = Math.max(0, linesAbove * effWidth - rolePrefixLen);
      displayContent = displayContent.slice(
        Math.min(skipChars, displayContent.length),
      );
    }

    // Tail-crop: the last `linesBelow` display lines are below the viewport.
    if (linesBelow > 0) {
      const keepChars = Math.max(
        0,
        displayContent.length - linesBelow * effWidth,
      );
      displayContent = displayContent.slice(0, keepChars);
    }

    slices.push({
      msg: messages[i],
      displayContent,
      headEllipsis: linesAbove > 0,
      tailEllipsis: linesBelow > 0,
      isFirst: slices.length === 0,
    });
  }

  return { slices, totalLines };
}

/** Estimate how many terminal lines a message will occupy once wrapped. */
function estimateMessageLines(
  msg: ConversationMessage,
  contentWidth: number,
): number {
  // Role label ("You: " or "Agent: ") plus content, plus trailing indicators.
  const rolePrefixLen = msg.role === "user" ? 5 : 7;
  const suffixLen = (msg.streaming ? 1 : 0) + (msg.interrupted ? 14 : 0);
  const totalChars = rolePrefixLen + msg.content.length + suffixLen;
  return Math.max(1, Math.ceil(totalChars / effectiveWidth(contentWidth)));
}
