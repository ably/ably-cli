import type { CursorUpdate, Lock, SpaceMember } from "@ably/spaces";

import {
  formatClientId,
  formatEventType,
  formatLabel,
  formatMessageTimestamp,
  formatResource,
} from "./output.js";

// --- JSON display interfaces (used by logJsonResult / logJsonEvent) ---

export interface MemberOutput {
  clientId: string;
  connectionId: string;
  isConnected: boolean;
  profileData: Record<string, unknown> | null;
  location: unknown | null;
  lastEvent: { name: string; timestamp: number };
}

export interface CursorOutput {
  clientId: string;
  connectionId: string;
  position: { x: number; y: number };
  data: Record<string, unknown> | null;
}

export interface LockOutput {
  id: string;
  status: string;
  member: MemberOutput;
  timestamp: number;
  attributes: Record<string, unknown> | null;
  reason: { message?: string; code?: number; statusCode?: number } | null;
}

export interface LocationEntry {
  connectionId: string;
  location: unknown;
}

// --- JSON formatters (SDK type → display interface) ---

export function formatMemberOutput(member: SpaceMember): MemberOutput {
  return {
    clientId: member.clientId,
    connectionId: member.connectionId,
    isConnected: member.isConnected,
    profileData: member.profileData ?? null,
    location: member.location ?? null,
    lastEvent: {
      name: member.lastEvent.name,
      timestamp: member.lastEvent.timestamp,
    },
  };
}

export function formatCursorOutput(cursor: CursorUpdate): CursorOutput {
  return {
    clientId: cursor.clientId,
    connectionId: cursor.connectionId,
    position: cursor.position,
    data: (cursor.data as Record<string, unknown>) ?? null,
  };
}

export function formatLockOutput(lock: Lock): LockOutput {
  return {
    id: lock.id,
    status: lock.status,
    member: formatMemberOutput(lock.member),
    timestamp: lock.timestamp,
    attributes: (lock.attributes as Record<string, unknown>) ?? null,
    reason: lock.reason
      ? {
          message: lock.reason.message,
          code: lock.reason.code,
          statusCode: lock.reason.statusCode,
        }
      : null,
  };
}

// --- Human-readable block formatters (for non-JSON output) ---

/**
 * Format a SpaceMember as a multi-line labeled block.
 * Used in members enter, members subscribe, and as nested output in locks.
 */
export function formatMemberBlock(
  member: SpaceMember,
  options?: { indent?: string },
): string {
  const indent = options?.indent ?? "";
  const lines: string[] = [
    `${indent}${formatLabel("Client ID")} ${formatClientId(member.clientId)}`,
    `${indent}${formatLabel("Connection ID")} ${member.connectionId}`,
    `${indent}${formatLabel("Connected")} ${member.isConnected}`,
  ];

  if (member.profileData && Object.keys(member.profileData).length > 0) {
    lines.push(
      `${indent}${formatLabel("Profile")} ${JSON.stringify(member.profileData)}`,
    );
  }

  if (member.location != null) {
    lines.push(
      `${indent}${formatLabel("Location")} ${JSON.stringify(member.location)}`,
    );
  }

  lines.push(
    `${indent}${formatLabel("Last Event")} ${formatEventType(member.lastEvent.name)}`,
    `${indent}${formatLabel("Event Timestamp")} ${formatMessageTimestamp(member.lastEvent.timestamp)}`,
  );

  return lines.join("\n");
}

/**
 * Format a SpaceMember event as a multi-line labeled block with action header.
 * Used in members subscribe and members enter for streaming events.
 */
export function formatMemberEventBlock(
  member: SpaceMember,
  action: string,
): string {
  const lines: string[] = [
    `${formatLabel("Action")} ${formatEventType(action)}`,
    `${formatLabel("Client ID")} ${formatClientId(member.clientId)}`,
    `${formatLabel("Connection ID")} ${member.connectionId}`,
    `${formatLabel("Connected")} ${member.isConnected}`,
  ];

  if (member.profileData && Object.keys(member.profileData).length > 0) {
    lines.push(
      `${formatLabel("Profile")} ${JSON.stringify(member.profileData)}`,
    );
  }

  if (member.location != null) {
    lines.push(`${formatLabel("Location")} ${JSON.stringify(member.location)}`);
  }

  return lines.join("\n");
}

/**
 * Format a CursorUpdate as a multi-line labeled block.
 */
export function formatCursorBlock(
  cursor: CursorUpdate,
  options?: { indent?: string },
): string {
  const indent = options?.indent ?? "";
  const lines: string[] = [
    `${indent}${formatLabel("Client ID")} ${formatClientId(cursor.clientId)}`,
    `${indent}${formatLabel("Connection ID")} ${cursor.connectionId}`,
    `${indent}${formatLabel("Position X")} ${cursor.position.x}`,
    `${indent}${formatLabel("Position Y")} ${cursor.position.y}`,
  ];

  if (
    cursor.data &&
    Object.keys(cursor.data as Record<string, unknown>).length > 0
  ) {
    lines.push(
      `${indent}${formatLabel("Data")} ${JSON.stringify(cursor.data)}`,
    );
  }

  return lines.join("\n");
}

/**
 * Format a Lock as a multi-line labeled block.
 */
export function formatLockBlock(
  lock: Lock,
  options?: { indent?: string },
): string {
  const indent = options?.indent ?? "";
  const memberIndent = indent ? indent + "  " : "  ";
  const lines: string[] = [
    `${indent}${formatLabel("Lock ID")} ${formatResource(lock.id)}`,
    `${indent}${formatLabel("Status")} ${formatEventType(lock.status)}`,
    `${indent}${formatLabel("Timestamp")} ${formatMessageTimestamp(lock.timestamp)}`,
    `${indent}${formatLabel("Member")}`,
    formatMemberBlock(lock.member, { indent: memberIndent }),
  ];

  if (
    lock.attributes &&
    Object.keys(lock.attributes as Record<string, unknown>).length > 0
  ) {
    lines.push(
      `${indent}${formatLabel("Attributes")} ${JSON.stringify(lock.attributes)}`,
    );
  }

  if (lock.reason) {
    lines.push(
      `${indent}${formatLabel("Reason")} ${lock.reason.message || lock.reason.toString()}`,
    );
  }

  return lines.join("\n");
}

/**
 * Format a location update event as a multi-line labeled block.
 */
export function formatLocationUpdateBlock(update: {
  member: SpaceMember;
  currentLocation: unknown;
  previousLocation: unknown;
}): string {
  const lines: string[] = [
    `${formatLabel("Client ID")} ${formatClientId(update.member.clientId)}`,
    `${formatLabel("Connection ID")} ${update.member.connectionId}`,
    `${formatLabel("Current Location")} ${JSON.stringify(update.currentLocation)}`,
  ];

  if (update.previousLocation != null) {
    lines.push(
      `${formatLabel("Previous Location")} ${JSON.stringify(update.previousLocation)}`,
    );
  }

  return lines.join("\n");
}
