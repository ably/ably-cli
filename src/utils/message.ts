import * as Ably from "ably";

export function interpolateMessage(template: string, count: number): string {
  let result = template.replaceAll("{{.Count}}", count.toString());
  result = result.replaceAll("{{.Timestamp}}", Date.now().toString());
  return result;
}

export function prepareMessageFromInput(
  rawMessage: string,
  serial: string,
  flags: Record<string, unknown>,
): Ably.Message {
  let messageData;
  try {
    const parsed = JSON.parse(rawMessage);
    // Only treat plain objects as structured message data; wrap primitives and arrays in { data: ... }
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      messageData = parsed;
    } else {
      messageData = { data: parsed };
    }
  } catch {
    messageData = { data: rawMessage };
  }

  const message: Partial<Ably.Message> = { serial };

  if (flags.name) {
    message.name = flags.name as string;
  } else if (messageData.name) {
    message.name = messageData.name;
    delete messageData.name;
  }

  if ("data" in messageData) {
    message.data = messageData.data;
  } else if (Object.keys(messageData).length > 0) {
    message.data = messageData;
  }

  if (flags.encoding) {
    message.encoding = flags.encoding as string;
  }

  return message as Ably.Message;
}
