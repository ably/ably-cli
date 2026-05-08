import * as Ably from "ably";

export function interpolateMessage(template: string, count: number): string {
  let result = template.replaceAll("{{.Count}}", count.toString());
  result = result.replaceAll("{{.Timestamp}}", Date.now().toString());
  return result;
}

export function prepareMessageFromInput(
  rawMessage: string,
  flags: Record<string, unknown>,
  options?: { serial?: string; interpolationIndex?: number },
): Ably.Message {
  // Apply interpolation if index provided
  const processedMessage =
    options?.interpolationIndex === undefined
      ? rawMessage
      : interpolateMessage(rawMessage, options.interpolationIndex);

  let messageData: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(processedMessage);
    // Only treat plain objects as structured message data; wrap primitives and arrays in { data: ... }
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      messageData = parsed as Record<string, unknown>;
    } else {
      messageData = { data: parsed };
    }
  } catch {
    messageData = { data: processedMessage };
  }

  const message: Partial<Ably.Message> = {};

  if (options?.serial !== undefined) {
    message.serial = options.serial;
  }

  if (flags.name) {
    message.name = flags.name as string;
  } else if (messageData.name) {
    message.name = messageData.name as string;
    delete messageData.name;
  }

  if (
    messageData.extras &&
    typeof messageData.extras === "object" &&
    Object.keys(messageData.extras).length > 0
  ) {
    message.extras = messageData.extras as Record<string, unknown>;
    delete messageData.extras;
  }

  if ("data" in messageData) {
    message.data = messageData.data;
  } else if (Object.keys(messageData).length > 0) {
    message.data = messageData;
  }

  if (flags.encoding) {
    message.encoding = flags.encoding as string;
  }

  return message;
}
