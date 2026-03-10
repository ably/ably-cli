# Spaces Command Group — Action Plan

> **Total issues: 25** (5 major, 9 moderate, 11 minor)
> **Files to modify: 7**
> **Generated from:** `ABLY_SPACES_COMMAND_GROUP_NEW_REVIEW.md`

---

## Issue Index

| # | File | Issue | Severity | Category |
|---|---|---|---|---|
| 1 | `locations/get-all.ts` | Dead interfaces (4 unused types) | Major | Dead code |
| 2 | `locations/get-all.ts` | Dead array handling branch | Moderate | Dead code |
| 3 | `locations/get-all.ts` | Dead `knownMetaKeys` + `extractLocationData()` | Moderate | Dead code |
| 4 | `locations/get-all.ts` | JSON schema incorrect (`memberId` → `connectionId`) | Major | Data correctness |
| 5 | `locations/get-all.ts` | Human display shows literal "Member" instead of connection ID | Major | Display bug |
| 6 | `locations/get-all.ts` | Human display double-wraps location data | Major | Display bug |
| 7 | `locations/get-all.ts` | `chalk.yellow()` instead of `formatWarning()` | Minor | Convention |
| 8 | `locations/get-all.ts` | `chalk.bold()` count instead of `formatCountLabel()` | Minor | Convention |
| 9 | `locations/get-all.ts` | Stale imports (`errorMessage`, `chalk`) | Minor | Cleanup |
| 10 | `locations/subscribe.ts` | Dead array handling branch | Moderate | Dead code |
| 11 | `locations/subscribe.ts` | Synthetic `SpaceMember` construction | Moderate | Unnecessary complexity |
| 12 | `locations/subscribe.ts` | Unnecessary local interfaces (3 types) | Moderate | Dead code |
| 13 | `locations/subscribe.ts` | `chalk.blue()` instead of `formatClientId()` | Minor | Convention |
| 14 | `locations/subscribe.ts` | `chalk.yellow()` instead of `formatWarning()` | Minor | Convention |
| 15 | `locations/subscribe.ts` | `chalk.bold()` count instead of `formatCountLabel()` | Minor | Convention |
| 16 | `locations/subscribe.ts` | `flags \|\| {}` unnecessary fallback | Minor | Cleanup |
| 17 | `cursors/get-all.ts` | Local types weaken type safety | Major | Type safety |
| 18 | `cursors/get-all.ts` | Dead array handling branch | Moderate | Dead code |
| 19 | `cursors/get-all.ts` | `chalk.yellow("Warning: ...")` x3 instead of `formatWarning()` | Moderate | Convention |
| 20 | `cursors/get-all.ts` | Missing `formatWarning` import | Minor | Convention |
| 21 | `cursors/get-all.ts` | Headings use `chalk.bold()` instead of `formatHeading()` | Minor | Convention |
| 22 | `mock-ably-spaces.ts` | `locations.getAll` default returns `[]` not `{}` | Moderate | Test correctness |
| 23 | `mock-ably-spaces.ts` | `cursors.getAll` default returns `[]` not `{}` | Moderate | Test correctness |
| 24 | `locations/get-all.test.ts` | Mock data uses wrong format (array of events) | Moderate | Test correctness |
| 25 | `cursors/get-all.test.ts` + `cursors/subscribe.test.ts` | Mock data uses array format | Minor | Test consistency |

---

## File 1: `src/commands/spaces/locations/get-all.ts`

### Issue #1 — Dead interfaces (MAJOR)

Four interfaces define data formats that `locations.getAll()` never returns. The SDK returns `Record<string, unknown>`.

**Current code (lines 16-45):**
```typescript
interface LocationData {
  [key: string]: unknown;
}

interface Member {
  clientId?: string;
  memberId?: string;
  isCurrentMember?: boolean;
}

interface LocationWithCurrent {
  current: {
    member: Member;
  };
  location?: LocationData;
  data?: LocationData;
  [key: string]: unknown;
}

interface LocationItem {
  [key: string]: unknown;
  clientId?: string;
  connectionId?: string;
  data?: LocationData;
  id?: string;
  location?: LocationData;
  member?: Member;
  memberId?: string;
  userId?: string;
}
```

**Suggested code:**
```typescript
interface LocationEntry {
  connectionId: string;
  location: unknown;
}
```

---

### Issue #2 — Dead array handling (MODERATE)

SDK returns `Record<string, unknown>`, never an array. The `Array.isArray` branch is dead code.

**Current code (lines 139-149):**
```typescript
if (locationsFromSpace && typeof locationsFromSpace === "object") {
  if (Array.isArray(locationsFromSpace)) {
    locations = locationsFromSpace as LocationItem[];
  } else if (Object.keys(locationsFromSpace).length > 0) {
    locations = Object.entries(locationsFromSpace).map(
      ([memberId, locationData]) => ({
        location: locationData,
        memberId,
      }),
    ) as LocationItem[];
  }
}
```

**Suggested code:**
```typescript
const locationsFromSpace = await this.space!.locations.getAll();
const entries: LocationEntry[] = Object.entries(locationsFromSpace)
  .filter(([, loc]) => loc != null &&
    !(typeof loc === "object" && Object.keys(loc as object).length === 0))
  .map(([connectionId, loc]) => ({ connectionId, location: loc }));
```

---

### Issue #3 — Dead `knownMetaKeys` + `extractLocationData()` (MODERATE)

Only `item.location` (line 163) ever executes. All other branches are dead code since mapped items only have `{ location, memberId }`.

**Current code (lines 152-172):**
```typescript
const knownMetaKeys = new Set([
  "clientId",
  "connectionId",
  "current",
  "id",
  "member",
  "memberId",
  "userId",
]);

const extractLocationData = (item: LocationItem): unknown => {
  if (item.location !== undefined) return item.location;
  if (item.data !== undefined) return item.data;
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item)) {
    if (!knownMetaKeys.has(key)) {
      rest[key] = value;
    }
  }
  return Object.keys(rest).length > 0 ? rest : null;
};
```

**Suggested code:** Delete entirely. With the simplified `LocationEntry`, location data is accessed directly as `entry.location`.

---

### Issue #4 — JSON output schema incorrect (MAJOR)

The JSON output mislabels connection IDs as "memberId" and includes a meaningless `isCurrentMember: false`.

**Current code (lines 189-219):**
```typescript
if (this.shouldOutputJson(flags)) {
  this.logJsonResult(
    {
      locations: validLocations.map((item: LocationItem) => {
        const currentMember =
          "current" in item &&
          item.current &&
          typeof item.current === "object"
            ? (item.current as LocationWithCurrent["current"]).member
            : undefined;
        const member = item.member || currentMember;
        const memberId =
          item.memberId ||
          member?.memberId ||
          member?.clientId ||
          item.clientId ||
          item.id ||
          item.userId ||
          "Unknown";
        const locationData = extractLocationData(item);
        return {
          isCurrentMember: member?.isCurrentMember || false,
          location: locationData,
          memberId,
        };
      }),
      spaceName,
      timestamp: new Date().toISOString(),
    },
    flags,
  );
}
```

**Suggested code:**
```typescript
if (this.shouldOutputJson(flags)) {
  this.logJsonResult(
    {
      locations: entries.map((entry) => ({
        connectionId: entry.connectionId,
        location: entry.location,
      })),
      spaceName,
      timestamp: new Date().toISOString(),
    },
    flags,
  );
}
```

**JSON output change:**
```
// BEFORE (incorrect):
{ "memberId": "conn-abc", "location": {...}, "isCurrentMember": false }

// AFTER (correct):
{ "connectionId": "conn-abc", "location": {...} }
```

---

### Issue #5 — Human display shows literal "Member" (MAJOR)

The `"current" in location` check at line 232 always fails for mapped items `{ location, memberId }`, so it falls to the else branch which displays the literal string "Member" instead of the actual connection ID.

**Current code (lines 261-267):**
```typescript
} else {
  // Simpler display if location doesn't have expected structure
  this.log(`- ${formatClientId("Member")}:`);
  this.log(
    `  ${formatLabel("Location")} ${JSON.stringify(location, null, 2)}`,
  );
}
```

**Suggested code:**
```typescript
this.log(`- ${formatClientId(entry.connectionId)}:`);
this.log(
  `  ${formatLabel("Location")} ${JSON.stringify(entry.location, null, 2)}`,
);
```

---

### Issue #6 — Human display double-wraps location data (MAJOR)

`JSON.stringify(location, null, 2)` at line 265 stringifies the entire `LocationItem` wrapper object, not just the location data.

**Current output:**
```
- Member:
  Location: {
    "location": {
      "x": 10,
      "y": 20
    },
    "memberId": "conn-abc"
  }
```

**Expected output after fix:**
```
- conn-abc:
  Location: {
    "x": 10,
    "y": 20
  }
```

This is fixed together with Issue #5 by using `entry.location` instead of the full item.

---

### Issue #7 — `chalk.yellow()` instead of `formatWarning()` (MINOR)

**Current code (line 222):**
```typescript
this.log(
  chalk.yellow("No locations are currently set in this space."),
);
```

**Suggested code:**
```typescript
this.log(
  formatWarning("No locations are currently set in this space."),
);
```

---

### Issue #8 — `chalk.bold()` count instead of `formatCountLabel()` (MINOR)

**Current code (lines 226-228):**
```typescript
this.log(
  `\n${formatHeading("Current locations")} (${chalk.bold(String(locationsCount))}):\n`,
);
```

**Suggested code:**
```typescript
this.log(
  `\n${formatHeading("Current locations")} (${formatCountLabel(locationsCount, "location")}):\n`,
);
```

Note: `formatCountLabel(2, "location")` returns `"2 locations"` with cyan count — slightly different visual from bold count, but consistent with project convention.

---

### Issue #9 — Stale imports (MINOR)

**Current imports (lines 1-14):**
```typescript
import { Args } from "@oclif/core";
import chalk from "chalk";

import { errorMessage } from "../../../utils/errors.js";
import { productApiFlags, clientIdFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import {
  formatClientId,
  formatHeading,
  formatLabel,
  formatProgress,
  formatResource,
  formatSuccess,
} from "../../../utils/output.js";
```

**Suggested imports:**
```typescript
import { Args } from "@oclif/core";

import { productApiFlags, clientIdFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import {
  formatClientId,
  formatCountLabel,
  formatHeading,
  formatLabel,
  formatProgress,
  formatResource,
  formatSuccess,
  formatWarning,
} from "../../../utils/output.js";
```

Changes: Remove `chalk`, remove `errorMessage`. Add `formatWarning`, `formatCountLabel`.

---

### Full rewrite summary for `locations/get-all.ts`

The `run()` method body from the `getAll()` call onward (lines 135-269) should be replaced. The rest of the file (class definition, flags, args, connection setup) stays the same. Here is the suggested replacement for the data processing + display section:

```typescript
// After connection is established and progress messages shown...

const entries: LocationEntry[] = [];
try {
  const locationsFromSpace = await this.space!.locations.getAll();

  for (const [connectionId, loc] of Object.entries(locationsFromSpace)) {
    if (loc == null) continue;
    if (typeof loc === "object" && Object.keys(loc as object).length === 0) continue;
    entries.push({ connectionId, location: loc });
  }

  if (this.shouldOutputJson(flags)) {
    this.logJsonResult(
      {
        locations: entries.map((entry) => ({
          connectionId: entry.connectionId,
          location: entry.location,
        })),
        spaceName,
        timestamp: new Date().toISOString(),
      },
      flags,
    );
  } else if (entries.length === 0) {
    this.log(formatWarning("No locations are currently set in this space."));
  } else {
    this.log(
      `\n${formatHeading("Current locations")} (${formatCountLabel(entries.length, "location")}):\n`,
    );

    for (const entry of entries) {
      this.log(`- ${formatClientId(entry.connectionId)}:`);
      this.log(
        `  ${formatLabel("Location")} ${JSON.stringify(entry.location, null, 2)}`,
      );
    }
  }
} catch (error) {
  this.fail(error, flags, "locationGetAll", { spaceName });
}
```

---

## File 2: `src/commands/spaces/locations/subscribe.ts`

### Issue #10 — Dead array handling branch (MODERATE)

SDK returns `Record<string, unknown>`, never an array.

**Current code (lines 112-128):**
```typescript
if (result && typeof result === "object") {
  if (Array.isArray(result)) {
    // Unlikely based on current docs, but handle if API changes
    // Need to map Array result to LocationItem[] if structure differs
    this.logCliEvent(
      flags,
      "location",
      "initialFormatWarning",
      "Received array format for initial locations, expected object",
    );
    // Assuming array elements match expected structure for now:
    locations = result.map(
      (item: { location: LocationData; member: SpaceMember }) => ({
        location: item.location,
        member: item.member,
      }),
    );
  } else if (Object.keys(result).length > 0) {
```

**Suggested code:**
```typescript
if (result && typeof result === "object" && Object.keys(result).length > 0) {
```

Remove the entire `Array.isArray` branch including the log event.

---

### Issue #11 — Synthetic `SpaceMember` construction (MODERATE)

Creates fake member objects where only `connectionId` is ever used downstream.

**Current code (lines 129-142):**
```typescript
} else if (Object.keys(result).length > 0) {
  // Standard case: result is an object { connectionId: locationData }
  locations = Object.entries(result).map(
    ([connectionId, locationData]) => ({
      location: locationData as LocationData,
      member: {
        // Construct a partial SpaceMember as SDK doesn't provide full details here
        clientId: "unknown", // clientId not directly available in getAll response
        connectionId,
        isConnected: true, // Assume connected for initial state
        profileData: null,
      },
    }),
  );
}
```

**Suggested code:**
```typescript
if (result && typeof result === "object" && Object.keys(result).length > 0) {
  locations = Object.entries(result)
    .filter(([, loc]) => loc != null)
    .map(([connectionId, locationData]) => ({
      connectionId,
      location: locationData as Record<string, unknown>,
    }));
}
```

---

### Issue #12 — Unnecessary local interfaces (MODERATE)

Three interfaces exist only to support the synthetic SpaceMember pattern.

**Current code (lines 20-34):**
```typescript
// Define interfaces for location types
interface SpaceMember {
  clientId: string;
  connectionId: string;
  isConnected: boolean;
  profileData: Record<string, unknown> | null;
}

interface LocationData {
  [key: string]: unknown;
}

interface LocationItem {
  location: LocationData;
  member: SpaceMember;
}
```

**Suggested code:**
```typescript
interface LocationEntry {
  connectionId: string;
  location: unknown;
}
```

Also update the type annotation at line 101:
```typescript
// BEFORE:
let locations: LocationItem[] = [];

// AFTER:
let locations: LocationEntry[] = [];
```

---

### Issue #13 — `chalk.blue()` instead of `formatClientId()` (MINOR)

`formatClientId` is already imported (line 8) and used in the subscription handler (line 232), but not used for the initial snapshot display.

**Current code (line 169):**
```typescript
this.log(
  `- Connection ID: ${chalk.blue(item.member.connectionId || "Unknown")}`,
);
```

**Suggested code:**
```typescript
this.log(`- ${formatClientId(entry.connectionId)}:`);
```

Note: Drops the `"Connection ID: "` prefix to match the simpler pattern used in `locations/get-all.ts`. The `formatClientId()` already renders in blue.

---

### Issue #14 — `chalk.yellow()` instead of `formatWarning()` (MINOR)

**Current code (line 161):**
```typescript
this.log(
  chalk.yellow("No locations are currently set in this space."),
);
```

**Suggested code:**
```typescript
this.log(formatWarning("No locations are currently set in this space."));
```

---

### Issue #15 — `chalk.bold()` count instead of `formatCountLabel()` (MINOR)

**Current code (line 165):**
```typescript
`\n${formatHeading("Current locations")} (${chalk.bold(locations.length.toString())}):\n`,
```

**Suggested code:**
```typescript
`\n${formatHeading("Current locations")} (${formatCountLabel(locations.length, "location")}):\n`,
```

---

### Issue #16 — `flags || {}` unnecessary fallback (MINOR)

**Current code (line 276):**
```typescript
if (!this.shouldOutputJson(flags || {})) {
```

**Suggested code:**
```typescript
if (!this.shouldOutputJson(flags)) {
```

---

### Import changes for `subscribe.ts`

**Current imports (lines 1-17):**
```typescript
import type { LocationsEvents } from "@ably/spaces";
import { Args } from "@oclif/core";
import chalk from "chalk";

import { productApiFlags, clientIdFlag, durationFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import {
  formatClientId,
  formatEventType,
  formatHeading,
  formatListening,
  formatProgress,
  formatResource,
  formatSuccess,
  formatTimestamp,
  formatLabel,
} from "../../../utils/output.js";
```

**Suggested imports:**
```typescript
import type { LocationsEvents } from "@ably/spaces";
import { Args } from "@oclif/core";

import { productApiFlags, clientIdFlag, durationFlag } from "../../../flags.js";
import { SpacesBaseCommand } from "../../../spaces-base-command.js";
import {
  formatClientId,
  formatCountLabel,
  formatEventType,
  formatHeading,
  formatLabel,
  formatListening,
  formatProgress,
  formatResource,
  formatSuccess,
  formatTimestamp,
  formatWarning,
} from "../../../utils/output.js";
```

Changes: Remove `chalk`. Add `formatCountLabel`, `formatWarning`. Keep `LocationsEvents` import (needed for subscription handler).

---

### JSON output for initial snapshot — reference (NO CHANGE NEEDED)

The JSON snapshot at lines 146-158 already outputs the correct schema:
```typescript
this.logJsonResult(
  {
    locations: locations.map((item) => ({
      connectionId: item.member.connectionId,
      location: item.location,
    })),
    spaceName,
    eventType: "locations_snapshot",
  },
  flags,
);
```

After refactoring to `LocationEntry`, this simplifies to:
```typescript
this.logJsonResult(
  {
    locations: locations.map((entry) => ({
      connectionId: entry.connectionId,
      location: entry.location,
    })),
    spaceName,
    eventType: "locations_snapshot",
  },
  flags,
);
```

Same schema, cleaner access path.

---

## File 3: `src/commands/spaces/cursors/get-all.ts`

### Issue #17 — Local types weaken type safety (MAJOR)

Local `CursorUpdate` has `clientId?` and `connectionId?` (optional), but the SDK's `CursorUpdate` has them as **required**. This forces unnecessary guards and fallbacks throughout.

**Current code (lines 14-24):**
```typescript
interface CursorPosition {
  x: number;
  y: number;
}

interface CursorUpdate {
  clientId?: string;
  connectionId?: string;
  data?: Record<string, unknown>;
  position: CursorPosition;
}
```

**Suggested code:**
```typescript
import { type CursorUpdate } from "@ably/spaces";
```

Delete both local interfaces entirely. `CursorUpdate` from the SDK includes `CursorPosition` already (`position: CursorPosition` is required).

Also add this import at line 1 (before the `@oclif/core` import):
```typescript
import { type CursorUpdate } from "@ably/spaces";
```

---

### Issue #18 — Dead array handling (MODERATE)

`cursors.getAll()` returns `Record<string, null | CursorUpdate>`, never an array.

**Current code (lines 197-218):**
```typescript
if (Array.isArray(allCursors)) {
  allCursors.forEach((cursor) => {
    if (
      cursor &&
      cursor.connectionId &&
      !cursorMap.has(cursor.connectionId)
    ) {
      cursorMap.set(cursor.connectionId, cursor as CursorUpdate);
    }
  });
} else if (allCursors && typeof allCursors === "object") {
  // Handle object return type
  Object.values(allCursors).forEach((cursor) => {
    if (
      cursor &&
      cursor.connectionId &&
      !cursorMap.has(cursor.connectionId)
    ) {
      cursorMap.set(cursor.connectionId, cursor as CursorUpdate);
    }
  });
}
```

**Suggested code:**
```typescript
for (const cursor of Object.values(allCursors)) {
  if (cursor && !cursorMap.has(cursor.connectionId)) {
    cursorMap.set(cursor.connectionId, cursor);
  }
}
```

Note: With SDK types, `cursor.connectionId` is required on non-null `CursorUpdate`, so the `cursor.connectionId` guard simplifies to just `cursor` (null check). The `as CursorUpdate` cast is also unnecessary since `Object.values()` already returns `(CursorUpdate | null)[]`.

---

### Issue #19 — `chalk.yellow("Warning: ...")` x3 (MODERATE)

Three warning messages use direct chalk instead of `formatWarning()`.

**Location 1 — Current code (lines 222-226):**
```typescript
if (!this.shouldOutputJson(flags)) {
  this.log(
    chalk.yellow(
      "Warning: Could not fetch all cursors, showing only live updates",
    ),
  );
}
```

**Suggested:**
```typescript
if (!this.shouldOutputJson(flags)) {
  this.log(formatWarning("Could not fetch all cursors, showing only live updates."));
}
```

**Location 2 — Current code (lines 249-253):**
```typescript
this.log(
  chalk.yellow(
    "No cursor updates are being sent in this space. Make sure other clients are actively setting cursor positions.",
  ),
);
```

**Suggested:**
```typescript
this.log(
  formatWarning("No cursor updates are being sent in this space. Make sure other clients are actively setting cursor positions."),
);
```

**Location 3 — Current code (lines 258-260):**
```typescript
this.log(chalk.yellow("No active cursors found in space."));
```

**Suggested:**
```typescript
this.log(formatWarning("No active cursors found in space."));
```

---

### Issue #20 — Missing `formatWarning` import (MINOR)

**Current imports (lines 7-12):**
```typescript
import {
  formatProgress,
  formatSuccess,
  formatResource,
  formatClientId,
} from "../../../utils/output.js";
```

**Suggested imports:**
```typescript
import {
  formatClientId,
  formatProgress,
  formatResource,
  formatSuccess,
  formatWarning,
} from "../../../utils/output.js";
```

Add `formatWarning`. Keep alphabetical order per convention.

---

### Issue #21 — Headings use `chalk.bold()` instead of `formatHeading()` (MINOR)

Two headings could use the `formatHeading()` helper for consistency.

**Location 1 — Current code (lines 265-268):**
```typescript
this.log(
  chalk.bold(
    `\nCursor Summary - ${cursors.length} cursor${cursors.length === 1 ? "" : "s"} found:\n`,
  ),
);
```

**Suggested:**
```typescript
this.log(
  `\n${formatHeading(`Cursor Summary - ${formatCountLabel(cursors.length, "cursor")} found`)}:\n`,
);
```

**Location 2 — Current code (line 354):**
```typescript
this.log(`\n${chalk.bold("Additional Data:")}`);
```

**Suggested:**
```typescript
this.log(`\n${formatHeading("Additional Data")}:`);
```

Note: If adopting `formatHeading` and `formatCountLabel`, add them to the import:
```typescript
import {
  formatClientId,
  formatCountLabel,
  formatHeading,
  formatProgress,
  formatResource,
  formatSuccess,
  formatWarning,
} from "../../../utils/output.js";
```

This is **optional** — the table rendering already uses extensive direct chalk, so these two headings are a minor consistency improvement. Keep `chalk` import either way (still needed for table box-drawing).

---

## File 4: `test/helpers/mock-ably-spaces.ts`

### Issue #22 — `locations.getAll` default returns `[]` not `{}` (MODERATE)

**Current code (line 177):**
```typescript
getAll: vi.fn().mockResolvedValue([]),
```

**Suggested code:**
```typescript
getAll: vi.fn().mockResolvedValue({}),
```

---

### Issue #23 — `cursors.getAll` default returns `[]` not `{}` (MODERATE)

**Current code (line 240):**
```typescript
getAll: vi.fn().mockResolvedValue([]),
```

**Suggested code:**
```typescript
getAll: vi.fn().mockResolvedValue({}),
```

---

## File 5: `test/unit/commands/spaces/locations/get-all.test.ts`

### Issue #24 — Mock data uses wrong format (MODERATE)

Mocks use `LocationsEvents.UpdateEvent` array format instead of `Record<string, unknown>`.

**Current code — test "should get all locations" (lines 29-35):**
```typescript
space.locations.getAll.mockResolvedValue([
  {
    member: { clientId: "user-1", connectionId: "conn-1" },
    currentLocation: { x: 100, y: 200 },
    previousLocation: null,
  },
]);
```

**Suggested code:**
```typescript
space.locations.getAll.mockResolvedValue({
  "conn-1": { x: 100, y: 200 },
});
```

**Current code — test "should output JSON envelope" (lines 50-56):**
```typescript
space.locations.getAll.mockResolvedValue([
  {
    member: { clientId: "user-1", connectionId: "conn-1" },
    currentLocation: { x: 100, y: 200 },
    previousLocation: null,
  },
]);
```

**Suggested code:**
```typescript
space.locations.getAll.mockResolvedValue({
  "conn-1": { x: 100, y: 200 },
});
```

**Current code — test "should handle no locations" (line 78):**
```typescript
space.locations.getAll.mockResolvedValue([]);
```

**Suggested code:**
```typescript
space.locations.getAll.mockResolvedValue({});
```

**Assertion updates needed (lines 63-72):**

After fixing the JSON output schema (Issue #4), the JSON envelope will contain `connectionId` instead of `memberId`. Update assertions accordingly:

```typescript
// Existing assertions that still hold:
expect(resultRecord).toHaveProperty("type", "result");
expect(resultRecord).toHaveProperty("command");
expect(resultRecord).toHaveProperty("success", true);
expect(resultRecord).toHaveProperty("spaceName", "test-space");
expect(resultRecord!.locations).toBeInstanceOf(Array);

// Add assertion for correct schema:
if (resultRecord!.locations.length > 0) {
  expect(resultRecord!.locations[0]).toHaveProperty("connectionId", "conn-1");
  expect(resultRecord!.locations[0]).toHaveProperty("location");
  expect(resultRecord!.locations[0]).not.toHaveProperty("memberId");
  expect(resultRecord!.locations[0]).not.toHaveProperty("isCurrentMember");
}
```

---

## File 6 + 7: `test/unit/commands/spaces/cursors/get-all.test.ts` + `subscribe.test.ts`

### Issue #25 — Mock data uses array format (MINOR for subscribe, MODERATE for get-all)

#### `cursors/get-all.test.ts`

**Current code — test "should get all cursors" (lines 29-42):**
```typescript
space.cursors.getAll.mockResolvedValue([
  {
    clientId: "user-1",
    connectionId: "conn-1",
    position: { x: 100, y: 200 },
    data: { color: "red" },
  },
  {
    clientId: "user-2",
    connectionId: "conn-2",
    position: { x: 300, y: 400 },
    data: { color: "blue" },
  },
]);
```

**Suggested code:**
```typescript
space.cursors.getAll.mockResolvedValue({
  "conn-1": {
    clientId: "user-1",
    connectionId: "conn-1",
    position: { x: 100, y: 200 },
    data: { color: "red" },
  },
  "conn-2": {
    clientId: "user-2",
    connectionId: "conn-2",
    position: { x: 300, y: 400 },
    data: { color: "blue" },
  },
});
```

**Current code — empty cases (lines 64, 133):**
```typescript
space.cursors.getAll.mockResolvedValue([]);
```

**Suggested code:**
```typescript
space.cursors.getAll.mockResolvedValue({});
```

**Current code — JSON output test (lines 101-108):**
```typescript
space.cursors.getAll.mockResolvedValue([
  {
    clientId: "user-1",
    connectionId: "conn-1",
    position: { x: 10, y: 20 },
    data: null,
  },
]);
```

**Suggested code:**
```typescript
space.cursors.getAll.mockResolvedValue({
  "conn-1": {
    clientId: "user-1",
    connectionId: "conn-1",
    position: { x: 10, y: 20 },
    data: null,
  },
});
```

#### `cursors/subscribe.test.ts`

Change all `cursors.getAll.mockResolvedValue([])` to `{}`. These are dead mocks (`cursors subscribe` never calls `getAll()`), but should match SDK type for consistency.

**Lines 29, 46, 63, 81, 117:**
```typescript
// BEFORE:
space.cursors.getAll.mockResolvedValue([]);

// AFTER:
space.cursors.getAll.mockResolvedValue({});
```

---

## Execution Order

Execute in this order to minimize broken intermediate states:

1. **Issue #22, #23** — Fix mock defaults in `test/helpers/mock-ably-spaces.ts`
2. **Issues #1-9** — Fix `src/commands/spaces/locations/get-all.ts` (biggest change)
3. **Issues #10-16** — Fix `src/commands/spaces/locations/subscribe.ts`
4. **Issues #17-21** — Fix `src/commands/spaces/cursors/get-all.ts`
5. **Issue #24** — Fix `test/unit/commands/spaces/locations/get-all.test.ts`
6. **Issue #25** — Fix `test/unit/commands/spaces/cursors/get-all.test.ts` + `subscribe.test.ts`
7. **Validate** — Run the mandatory workflow:
   ```bash
   pnpm prepare           # Build + update manifest
   pnpm exec oclif readme # Regenerate README
   pnpm exec eslint .     # Must be 0 errors
   pnpm test:unit         # All tests pass
   pnpm test:tty          # TTY tests pass (local only)
   ```

---

## Conventions Checklist (from CLAUDE.md)

- [ ] No `chalk.yellow("Warning: ...")` — use `formatWarning()`
- [ ] No `chalk.blue(id)` for identifiers — use `formatClientId()`
- [ ] No `chalk.bold(count)` for counts — use `formatCountLabel()`
- [ ] No local interface shadows of SDK types — import from `@ably/spaces`
- [ ] No `Array.isArray` handling for SDK methods that return `Record<string, ...>`
- [ ] JSON envelopes use `this.logJsonResult()` / `this.logJsonEvent()` — ✅ already done
- [ ] Error handling uses `this.fail()` — ✅ already done
- [ ] JSON guard uses `this.shouldOutputJson(flags)` — ✅ already done
- [ ] Test mocks match SDK return types
- [ ] All 5 required test describe blocks present — ✅ already done
