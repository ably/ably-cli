# Plan: CLI Consistency — Output Format (DX-791) + Flags/Args (DX-787)

## Context

The CLI has grown organically across product areas (Channels, Rooms, Spaces, Control API), resulting in significant inconsistencies in both user-facing output messages and flag/argument naming. This makes the CLI feel disjointed — e.g., `channels publish` shows `✓ Message published successfully to channel "foo".` while `rooms messages send` shows just `Message sent successfully.` (no checkmark, no resource name). Flag descriptions for the same concept (`--app`, `--limit`, `--duration`) vary across commands. This effort standardizes both dimensions together and documents the conventions in CLAUDE.md so future development stays consistent.

---

## Part 1: Define the Standards

### Output Message Standards

**Progress messages** (operation starting/in-progress):
```
<Action> <resource-type>: <chalk.cyan(name)>...
```
- No color on the action text (green on progress is wrong — it implies success)
- Always end with `...`
- Examples: `Attaching to channel: my-channel...`, `Creating app: My App...`

**Success messages** (one-shot operation completed):
```
<chalk.green("✓")> <Past-tense action> <resource> <chalk.cyan(name)>.
```
- Always start with green `✓`
- Always end with `.`
- Resource names in `chalk.cyan()`, never in quotes
- Examples: `✓ Message published to channel my-channel.`, `✓ Message sent to room my-room.`, `✓ App created: My App (app-id).`

**Listening/waiting hints** (long-running command is ready):
```
chalk.dim("Listening for <what>. Press Ctrl+C to exit.")
```
- Always `chalk.dim()`
- Always ends with `.`
- Consistent wording: `Press Ctrl+C to exit.`
- First clause varies by context: `Listening for messages.`, `Staying present.`, `Holding lock.`

**Subscribe confirmation** (long-running command connected successfully):
```
<chalk.green("✓")> Subscribed to <resource-type>: <chalk.cyan(name)>.
chalk.dim("Listening for <what>. Press Ctrl+C to exit.")
```

**Resource name formatting**: Always `chalk.cyan()`. Never quoted in human output.

**Terminology**: Keep product-specific verbs matching each SDK — Channels uses "publish" (`channel.publish()`), Rooms uses "send" (`room.messages.send()`). Don't force unification here.

### Flag/Argument Standards

**Naming**: All flags kebab-case (`--my-flag`). No camelCase.

**Standard descriptions for common flags**:

| Flag | Standard Description |
|------|---------------------|
| `--app` | `"The app ID or name (defaults to current app)"` |
| `--limit` | `"Maximum number of results to return (default: N)"` |
| `--duration` | `"Automatically exit after N seconds (0 = run indefinitely)"` |
| `--prefix` | `"Filter results by name prefix"` |
| `--count` | `"Number of messages to send (default: 1)"` |
| `--delay` | `"Delay between messages in milliseconds (default: 40)"` |
| `--rewind` | `"Number of historical messages to retrieve on attach (default: 0)"` |

**Single-letter aliases** — keep existing, no new ones needed. Fix the `-d` collision: `--duration` uses `-D` (uppercase) everywhere.

---

## Part 2: Implementation

### Step 1: Create output helper utility (NEW file)

**File**: `src/utils/output.ts`

Thin exported functions (not a class) that enforce the patterns:

```typescript
import chalk from "chalk";

export function progress(message: string): string {
  return `${message}...`;
}

export function success(message: string): string {
  return `${chalk.green("✓")} ${message}`;
}

export function listening(description: string): string {
  return chalk.dim(`${description} Press Ctrl+C to exit.`);
}

export function resource(name: string): string {
  return chalk.cyan(name);
}
```

Commands import and use these to stay consistent. Lightweight — just enforces checkmark color, dim hints, cyan names.

### Step 2: Fix flag issues (DX-787)

1. **Rename `autoType` to `auto-type`** in `src/commands/rooms/typing/keystroke.ts`
   - CLI is Public Preview, direct rename is fine

2. **Remove duplicate `json` flag** from:
   - `src/commands/logs/push/subscribe.ts`
   - `src/commands/logs/channel-lifecycle/subscribe.ts`
   - These shadow the global `--json` flag from the base command

3. **Standardize `--app` flag descriptions** across all ~24 files that define it:
   - `src/commands/auth/keys/*.ts`
   - `src/commands/integrations/*.ts`
   - `src/commands/queues/*.ts`
   - `src/commands/apps/channel-rules/*.ts`
   - `src/commands/channels/inspect.ts`
   - `src/commands/auth/issue-ably-token.ts`, `issue-jwt-token.ts`, `revoke-token.ts`
   - All get: `"The app ID or name (defaults to current app)"`

4. **Standardize `--limit` descriptions** across ~11 files

5. **Standardize `--duration` descriptions** across subscribe/enter commands
   - Fix `bench/subscriber.ts` alias from `-d` to `-D` (matches all other duration flags)

### Step 3: Fix output messages — Channels commands (DX-791)

| File | Change |
|------|--------|
| `channels/publish.ts:172` | `"Message published successfully to channel \"${channel}\""` → `success(\`Message published to channel ${resource(channel)}.\`)` |
| `channels/publish.ts:168` | Multi-msg summary: add `success()` wrapper |
| `channels/publish.ts:292` | Per-msg: same pattern |
| `channels/subscribe.ts:178` | Already close — just import `resource()` for cyan |
| `channels/subscribe.ts:263` | Use `success()` + `listening()` |
| `channels/presence/subscribe.ts:75` | Remove `chalk.green()` from progress text (green ≠ progress) |
| `channels/presence/subscribe.ts:130` | Wrap in `chalk.dim()` |
| `channels/presence/enter.ts:196-207` | Standardize hint with `listening()` |
| `channels/occupancy/subscribe.ts:80-82` | Remove `chalk.green()` from progress |
| `channels/occupancy/subscribe.ts:127` | Wrap in `chalk.dim()` |

### Step 4: Fix output messages — Rooms commands

| File | Change |
|------|--------|
| `rooms/messages/send.ts:390` | `"Message sent successfully."` → `success(\`Message sent to room ${resource(room)}.\`)` |
| `rooms/messages/send.ts:349` | Multi-msg summary: add `success()` wrapper |
| `rooms/messages/subscribe.ts:191-195` | Standardize subscribe confirmation |
| `rooms/presence/enter.ts:229-237` | Use `chalk.green("✓")` consistently |
| `rooms/presence/subscribe.ts:60` | Split progress and listening hint |
| `rooms/occupancy/subscribe.ts:168` | Wrap in `chalk.dim()` |
| `rooms/reactions/subscribe.ts:112` | Standardize format |
| `rooms/typing/subscribe.ts:99` | Already uses `chalk.dim()` — verify format |

### Step 5: Fix output messages — Spaces commands

| File | Change |
|------|--------|
| `spaces/members/enter.ts:147` | `chalk.green("Successfully entered space:")` → `success(\`Entered space: ${resource(name)}.\`)` |
| `spaces/members/subscribe.ts:52` | Add `...` suffix to progress msg |
| `spaces/locks/acquire.ts:168` | `chalk.green("Successfully acquired lock:")` → `success(...)` |
| `spaces/locations/set.ts:163,238` | Add checkmark |
| `spaces/cursors/get-all.ts:109` | Add checkmark |

### Step 6: Fix output messages — Logs + Control Plane commands

| File | Change |
|------|--------|
| `logs/subscribe.ts:114-116` | Remove `chalk.green()` from progress |
| `logs/subscribe.ts:165` | Wrap in `chalk.dim()` |
| `logs/push/subscribe.ts` | Fix Ctrl+C hint (add period, use `chalk.dim()`) |
| `logs/channel-lifecycle/subscribe.ts` | Same |
| `logs/connection-lifecycle/subscribe.ts:120` | Wrap in `chalk.dim()` |
| `apps/create.ts:62` | `"✓ App created successfully!"` → `success(\`App created: ${resource(name)} (${id}).\`)` |
| `queues/create.ts:75` | Same pattern |
| `auth/keys/create.ts:110` | Same pattern |
| `integrations/create.ts:158` | Same pattern |
| `integrations/delete.ts` | Same pattern |

### Cross-cutting: Standardize logCliEvent() strings

In every command file being touched (Steps 3-7), also update `logCliEvent()` message strings to use consistent terminology:
- Use same verbs as user-facing output: "published" for channels, "sent" for rooms
- Use consistent phrasing: `"Message published to channel foo"` not `"Message published successfully to channel \"foo\""`
- Remove unnecessary "successfully" from event messages — the event type (`singlePublishComplete`, `sentSuccess`) already conveys success
- Keep event type identifiers (`"singlePublishComplete"`, `"multiSendComplete"`, etc.) unchanged — only the human-readable message string changes

### Step 7: Fix output messages — Bench commands

| File | Change |
|------|--------|
| `bench/publisher.ts` | Standardize progress/success messages to use `success()`, `resource()` |
| `bench/subscriber.ts` | Same + fix `--duration` alias from `-d` to `-D` |

### Step 8: Update tests

Update string assertions in:
- `test/unit/commands/channels/publish.test.ts`
- `test/unit/commands/rooms/messages.test.ts` (or similar)
- `test/unit/commands/apps/create.test.ts`
- `test/unit/commands/queues/create.test.ts`
- `test/e2e/channels/channels-e2e.test.ts` (line 239)
- `test/e2e/channels/channel-subscribe-e2e.test.ts` (line 77)
- `test/e2e/rooms/rooms-e2e.test.ts` (lines 266, 294, 296, 334)
- Any other tests that assert on exact output strings

### Step 9: Document conventions in CLAUDE.md

Add a section to `.claude/CLAUDE.md`:

```markdown
## CLI Output & Flag Conventions

### Output patterns (use helpers from src/utils/output.ts)
- **Progress**: `"Attaching to channel: ${resource(name)}..."` — no color on action text
- **Success**: `success("Message published to channel ${resource(name)}.")` — green ✓, ends with `.`
- **Listening**: `listening("Listening for messages.")` — dim, includes "Press Ctrl+C to exit."
- **Resource names**: Always `resource(name)` (cyan), never quoted

### Flag conventions
- All flags kebab-case: `--my-flag` (never camelCase)
- `--app`: `"The app ID or name (defaults to current app)"`
- `--limit`: `"Maximum number of results to return (default: N)"`
- `--duration`: `"Automatically exit after N seconds (0 = run indefinitely)"`, alias `-D`
- Channels use "publish", Rooms use "send" (matches SDK terminology)
```

Also update `.cursor/rules/AI-Assistance.mdc` with the same patterns.

---

## Verification

After implementation:
1. `pnpm prepare` — build succeeds
2. `pnpm exec eslint .` — 0 errors
3. `pnpm test:unit` — all unit tests pass
4. Manual smoke test key commands:
   - `ably channels publish test-ch "hello"` — verify `✓ Message published to channel test-ch.`
   - `ably rooms messages send test-room "hello"` — verify `✓ Message sent to room test-room.`
   - `ably channels subscribe test-ch` — verify progress + listening hint format
   - `ably apps create --name test-app` — verify `✓ App created: test-app (id).`

---

## Decisions

- **Single PR** — all changes in one cohesive changeset
- **Skip "Using:" line** — doesn't exist in codebase, separate concern for later
- **Standalone functions** in `src/utils/output.ts` (not base command methods)
- **Include logCliEvent() strings** — standardize internal event messages too for full consistency
- **Include bench commands** — apply same output conventions to `bench/publisher.ts` and `bench/subscriber.ts`
- **JSON output unchanged** — `--json` / `--pretty-json` output is NOT affected, only human-readable output

## Risks

- **E2E test ready signals**: Some E2E tests use output strings (e.g., `"Successfully attached to channel"`) as synchronization signals to detect when a command is ready. Must update these carefully to avoid flaky tests.
- **Scope**: ~50+ files but changes are mechanical string replacements. Low risk of logic bugs.
