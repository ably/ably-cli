# Plan: Smart AI Tool Detection for `ably init`

## Context

The `ably init` command currently blindly installs skills to all targets (Claude Code, Cursor, generic agents) via file copy. We want it to:
1. Auto-detect which AI coding tools the user actually has installed
2. Use Claude Code's native plugin mechanism (`claude plugin marketplace add` / `claude plugin install`) when Claude Code is detected
3. Fall back to file-copy for all other detected tools
4. Show the user what was found before proceeding

## UX Flow

```
$ ably init

  [Ably logo]

  Step 1: Authenticate with Ably
  ...

  Step 2: Detect AI coding tools

  ✓ Detected 3 AI coding tools:
    ● Claude Code   (cli: claude)        → plugin install
    ● Cursor        (app: Cursor.app)    → file copy
    ● VS Code       (cli: code)          → file copy

    Not found: Windsurf, Zed, Continue.dev

  Step 3: Download Ably Agent Skills
  ✓ Downloaded 7 skills

  Step 4: Install skills
  ✓ Claude Code   → installed via plugin system
  ✓ Cursor        → .cursor/skills/   (7 skills)
  ✓ VS Code       → .vscode/skills/   (7 skills)

  Done! Restart your IDE to activate Ably skills.
```

## Files to Create

### 1. `src/services/tool-detector.ts` — AI tool detection service

Detects installed tools via CLI binaries, app paths, and config directories.

```typescript
interface DetectedTool {
  id: string;                          // "claude-code", "cursor", "vscode", etc.
  name: string;                        // "Claude Code", "Cursor", etc.
  detected: boolean;
  evidence: string[];                  // ["cli: claude", "config: ~/.claude/"]
  installMethod: "plugin" | "file-copy";
}
```

**Detection matrix:**

| Tool | CLI (`which`) | macOS App | Config Dir | Install Method |
|------|--------------|-----------|------------|----------------|
| Claude Code | `claude` | — | `~/.claude/` | `plugin` |
| Cursor | `cursor` | `/Applications/Cursor.app` | `~/.cursor/` | `file-copy` |
| VS Code | `code` | `/Applications/Visual Studio Code.app` | `~/.vscode/` | `file-copy` |
| Windsurf | `windsurf` | `/Applications/Windsurf.app` | — | `file-copy` |
| Zed | `zed` | `/Applications/Zed.app` | `~/.config/zed/` | `file-copy` |
| Continue.dev | — | — | `~/.continue/` | `file-copy` |

Implementation:
- Use `which`/`where` via `child_process.execFile` with 2s timeout for CLI checks
- Use `fs.existsSync` for directory/app checks
- Run all tool detections in parallel via `Promise.all`
- Platform-specific checks keyed on `process.platform` (`darwin`, `linux`, `win32`)
- Detection errors are swallowed — a failing check just means "not detected"

### 2. `src/services/claude-plugin-installer.ts` — Claude Code plugin install

Shells out to the `claude` CLI for native plugin installation:

```typescript
// Step 1: Add marketplace
// $ claude plugin marketplace add ably/agent-skills
//
// Step 2: Install plugin
// $ claude plugin install ably-skills@ably-agent-skills
```

- Uses `child_process.execFile` with 30s timeout
- Returns status: `"installed"` | `"already-installed"` | `"error"`
- On error, init.ts falls back to file-copy for Claude Code

### 3. `test/unit/services/tool-detector.test.ts`
### 4. `test/unit/services/claude-plugin-installer.test.ts`

Mock `child_process.execFile` and `fs.existsSync`. Test each tool detection independently + parallel detection. Test plugin install success, already-installed, and failure paths.

## Files to Modify

### 5. `src/commands/init.ts` — Updated command flow

- Change `--target` default from `["all"]` to `["auto"]`
- Add `"auto"` to target options (plus `"vscode"`, `"windsurf"`, `"zed"`, `"continue"`)
- New flow: Auth → **Detect** → Download → Install
- When `--target auto`: run detection, install only for detected tools
- When `--target all` or specific targets: skip detection, use specified targets (existing behavior)
- For Claude Code: try plugin install first, fall back to file-copy on failure
- Skip download entirely if only Claude Code detected (plugin handles its own download)

### 6. `src/services/skills-installer.ts` — Expand TARGET_CONFIGS

Add new entries to `TARGET_CONFIGS`:

| id | projectDir | globalDir |
|----|-----------|-----------|
| `vscode` | `.vscode/skills` | `~/.vscode/skills` |
| `windsurf` | `.windsurf/skills` | `~/.windsurf/skills` |
| `zed` | `.zed/skills` | `~/.config/zed/skills` |
| `continue` | `.continue/skills` | `~/.continue/skills` |

Keep existing `claude-code`, `cursor`, `agents` entries unchanged.

### 7. `test/unit/commands/init.test.ts` — Updated tests
### 8. `test/unit/services/skills-installer.test.ts` — Tests for new targets

## Implementation Order

1. `src/services/tool-detector.ts` + tests (independent)
2. `src/services/claude-plugin-installer.ts` + tests (independent)
3. `src/services/skills-installer.ts` — expand TARGET_CONFIGS
4. `src/commands/init.ts` — wire it all together
5. Update all tests
6. Run `pnpm prepare && pnpm exec eslint . && pnpm test:unit`

## Verification

```bash
# Build and lint
pnpm prepare
pnpm exec eslint .

# Unit tests
pnpm test:unit

# Manual testing
./bin/dev.js init --skip-auth              # Should auto-detect and install
./bin/dev.js init --skip-auth --target all # Should bypass detection
./bin/dev.js init --skip-auth --target cursor # Should only install to Cursor
```
