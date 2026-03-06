import { MessageReactionType } from "@ably/chat";

/** Map CLI-friendly type names to SDK MessageReactionType values */
export const REACTION_TYPE_MAP: Record<string, MessageReactionType> = {
  unique: MessageReactionType.Unique,
  distinct: MessageReactionType.Distinct,
  multiple: MessageReactionType.Multiple,
};
