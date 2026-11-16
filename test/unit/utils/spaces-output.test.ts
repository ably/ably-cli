import { describe, it, expect } from "vitest";
import type { Lock, SpaceMember } from "@ably/spaces";

import {
  formatCursorBlock,
  formatLocationUpdateBlock,
  formatLockBlock,
  formatMemberBlock,
} from "../../../src/utils/spaces-output.js";

// U+009B is an 8-bit CSI: "\u009BA" is cursor-up. JSON.stringify leaves it
// raw, so without escaping the log() backstop silently deletes it and the
// displayed key or value differs from what was sent.
const hidden = { "\u009BAstatus": "acct-\u009B5A42" };

const member = {
  clientId: "client-1",
  connectionId: "conn-1",
  isConnected: true,
  profileData: hidden,
  location: hidden,
  lastEvent: { name: "enter", timestamp: 1700000000000 },
} as unknown as SpaceMember;

const lock = {
  id: "lock-1",
  status: "locked",
  member,
  timestamp: 1700000000000,
  attributes: hidden,
} as unknown as Lock;

const lineWith = (output: string, label: string): string =>
  output.split("\n").find((line) => line.includes(label)) ?? "";

describe("spaces output formatters", () => {
  it.each([
    {
      field: "member profile data",
      output: lineWith(formatMemberBlock(member), "Profile"),
    },
    {
      field: "member location",
      output: lineWith(formatMemberBlock(member), "Location"),
    },
    {
      field: "cursor data",
      output: formatCursorBlock({
        clientId: "client-1",
        connectionId: "conn-1",
        position: { x: 1, y: 2 },
        data: hidden,
      }),
    },
    {
      field: "lock attributes",
      output: lineWith(formatLockBlock(lock), "Attributes"),
    },
    {
      field: "current location",
      output: lineWith(
        formatLocationUpdateBlock({
          member,
          currentLocation: hidden,
          previousLocation: null,
        }),
        "Current Location",
      ),
    },
    {
      field: "previous location",
      output: lineWith(
        formatLocationUpdateBlock({
          member,
          currentLocation: null,
          previousLocation: hidden,
        }),
        "Previous Location",
      ),
    },
  ])("renders C1 characters in $field visibly", ({ output }) => {
    expect(output).not.toContain("\u009B");
    expect(output).toContain(String.raw`"\u009bAstatus"`);
    expect(output).toContain(String.raw`"acct-\u009b5A42"`);
  });
});
