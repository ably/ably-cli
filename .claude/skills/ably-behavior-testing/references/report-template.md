# Report Templates

Three categories of templates: **help report templates** (for REPORT_HELP.md — all `--help` output), **per-mode report templates** (for REPORT_NON_JSON.md and REPORT_JSON.md — functional output only, no analysis), and **primary report templates** (for REPORT_PRIMARY.md — all analysis and issues).

## How Reports Are Built

All evidence reports (REPORT_HELP.md, REPORT_NON_JSON.md, REPORT_JSON.md) are built **incrementally during Step 3** (Execute Tests), not in a separate report-generation step. For each command:

1. Execute → capture stdout/stderr/exit code to temp files under `temp/<command-name>/`
2. Use the **Read tool** to read `stdout.txt`, `stderr.txt`, `exitcode.txt` from the temp directory
3. Use the **Edit tool** to append a section to the appropriate report file, copying the Read output **verbatim**

This ensures reports contain exact CLI output, not paraphrased context. The Read tool is the bridge between temp files and report content.

**Report routing:**
- `--help` commands → **REPORT_HELP.md** (mode-independent, separated to keep functional reports focused)
- Human-readable functional commands → **REPORT_NON_JSON.md**
- `--pretty-json` functional commands → **REPORT_JSON.md**

---

## Help Report Templates (REPORT_HELP.md)

All `--help` output goes here — both topic-level (e.g., `ably channels --help`) and command-level (e.g., `ably channels publish --help`). Help output is mode-independent, so separating it into its own report keeps REPORT_NON_JSON.md focused on functional test evidence.

### Template: Help Command

```markdown
---

### `ably <group> <subcommand> --help`

**Command:**
\`\`\`bash
pnpm cli <group> <subcommand> --help
\`\`\`

**Execution Metadata:**
- Timestamp: [from temp/<command-name>-help/timestamp.txt]
- stdout: [N bytes, N lines]

**stdout:**
\`\`\`
[Paste COMPLETE --help output here — every line]
\`\`\`

**stderr:**
\`\`\`
(empty)
\`\`\`

**Exit Code:** 0

---
```

---

## Per-Mode Report Templates (REPORT_NON_JSON.md / REPORT_JSON.md)

These templates are for the **functional output-only evidence files**. Every entry has the same simple structure: command, execution metadata, stdout, stderr, exit code. No pass/fail tables, no analysis, no issue descriptions. No `--help` output — that goes to REPORT_HELP.md.

### Template: Any Command (Universal)

Every command — whether it's a publish, subscribe, history, list, get, help, or error — uses this same format. The `[contents of ...]` placeholders are filled by copying verbatim from the Read tool output of the corresponding temp file.

```markdown
---

### `ably <group> <subcommand>`

**Command:**
\`\`\`bash
pnpm cli <group> <subcommand> [args] [flags]
\`\`\`

**Execution Metadata:**
- Timestamp: [from temp/<command-name>/timestamp.txt]
- stdout: [N bytes, N lines] | stderr: [N bytes, N lines]
- JSON valid: [yes/no/n/a] | Stream clean: [yes/no/n/a]

**stdout:**
\`\`\`
[verbatim contents of temp/<command-name>/stdout.txt via Read tool]
\`\`\`

**stderr:**
\`\`\`
[verbatim contents of temp/<command-name>/stderr.txt via Read tool, or "(empty)" if file is empty]
\`\`\`

**Exit Code:** [contents of temp/<command-name>/exitcode.txt]

---
```

The **Execution Metadata** line serves three purposes:
1. **Traceability** — timestamp links the report entry to the exact execution moment
2. **Integrity** — byte/line counts from post-capture validation let reviewers verify the report captured the full output (if a report shows 3 lines but metadata says 50 lines, something was truncated)
3. **Automated auditing** — JSON validity and stream cleanliness are recorded upfront so REPORT_PRIMARY.md can reference them without re-reading raw output

### Template: Subscribe Command (with concurrent publish)

For subscribe workflows, capture ALL outputs — subscriber AND each publish command:

```markdown
---

### `ably <group> subscribe` (with concurrent publish)

**Subscribe Command:**
\`\`\`bash
pnpm cli <group> subscribe <resource> --duration 15
\`\`\`

**Publish Commands (run while subscriber was active):**

**Publish 1:**
\`\`\`bash
pnpm cli <group> publish <resource> "Message 1"
\`\`\`
stdout: \`\`\`[verbatim from publish1_stdout.txt]\`\`\`
stderr: \`\`\`[verbatim from publish1_stderr.txt]\`\`\`

**Publish 2:**
\`\`\`bash
pnpm cli <group> publish <resource> "Message 2"
\`\`\`
stdout: \`\`\`[verbatim from publish2_stdout.txt]\`\`\`
stderr: \`\`\`[verbatim from publish2_stderr.txt]\`\`\`

**Publish 3:**
\`\`\`bash
pnpm cli <group> publish <resource> "Message 3"
\`\`\`
stdout: \`\`\`[verbatim from publish3_stdout.txt]\`\`\`
stderr: \`\`\`[verbatim from publish3_stderr.txt]\`\`\`

**Subscriber stdout:**
\`\`\`
[verbatim from temp/<subscribe-dir>/stdout.txt]
\`\`\`

**Subscriber stderr:**
\`\`\`
[verbatim from temp/<subscribe-dir>/stderr.txt]
\`\`\`

**Subscriber Exit Code:** [from exitcode.txt]

---
```

### Template: Flag Variations

When testing the same command with different flag combinations, each variation gets its own section:

```markdown
---

### `ably <group> <subcommand> --limit 1`

**Command:**
\`\`\`bash
pnpm cli <group> <subcommand> <resource> --limit 1
\`\`\`

**stdout:**
\`\`\`
[Paste COMPLETE stdout]
\`\`\`

**stderr:**
\`\`\`
[Paste COMPLETE stderr]
\`\`\`

**Exit Code:** N

---

### `ably <group> <subcommand> --direction forwards`

**Command:**
\`\`\`bash
pnpm cli <group> <subcommand> <resource> --direction forwards
\`\`\`

**stdout:**
\`\`\`
[Paste COMPLETE stdout]
\`\`\`

**stderr:**
\`\`\`
[Paste COMPLETE stderr]
\`\`\`

**Exit Code:** N

---
```

### Template: Skipped Command (config-dependent)

When a command can't be functionally tested (missing config, feature not enabled), still run it to capture the error output. The error message itself is a test subject — does it tell the user how to fix the problem?

**In per-mode reports** — capture the error output AND help:

```markdown
---

### `ably <group> <subcommand>` — SKIPPED (functional) / TESTED (error path)

**Reason:** [Why functional testing was not possible]

**Command:**
\`\`\`bash
pnpm cli <group> <subcommand> [args]
\`\`\`

**stdout:**
\`\`\`
[verbatim error stdout — may be empty or contain JSON error envelope]
\`\`\`

**stderr:**
\`\`\`
[verbatim error stderr — the error message is the test subject]
\`\`\`

**Exit Code:** [non-zero]

---
```

The `--help` for a skipped command is still captured as a normal help entry in REPORT_HELP.md (see Help Report Templates section above).

**In REPORT_PRIMARY.md** — if the error message lacks actionable CLI guidance, log as an issue:

```markdown
### Issue N: `<command>` error doesn't guide user to enable required config (Severity)

- **Severity:** Minor or Major
- **Affected command(s):** [list all affected]
- **Description:** Error says "[feature] not enabled" but doesn't include the CLI command to enable it. Users must guess or search docs.
- **Expected:** Error includes actionable CLI command (e.g., "Enable with `ably apps rules update <namespace> --persist-last-message-enabled`")
- **Actual:** [paste the actual error message]
```

### Template: Error Path

```markdown
---

### `ably <group> <subcommand>` — Missing required argument

**Command:**
\`\`\`bash
pnpm cli <group> <subcommand>
\`\`\`

**stdout:**
\`\`\`
[Paste stdout — may be empty]
\`\`\`

**stderr:**
\`\`\`
[Paste COMPLETE stderr — error messages]
\`\`\`

**Exit Code:** N

---
```

---

## Primary Report Templates (REPORT_PRIMARY.md)

All analysis, validation, and issue documentation goes here. This is where pass/fail judgments, cross-mode comparisons, and issue details live.

### Template: Commands Tested Table

```markdown
## Commands Tested

| Command | Human-Readable | JSON | Notes |
|---------|---------------|------|-------|
| `channels --help` | PASS | N/A | |
| `channels publish --help` | PASS | N/A | |
| `channels publish` | PASS | PASS | |
| `channels subscribe` | PASS | PASS | Received 3/3 messages |
| `channels history` | PASS | PASS | |
| `channels history --limit 1` | PASS | PASS | Returned exactly 1 |
| `channels history --direction forwards` | PASS | PASS | Oldest first |
| `channels list` | PASS | PASS | |
| `channels append` | SKIP | SKIP | Requires mutableMessages |
| ... | ... | ... | ... |
```

### Template: Issue Entry

```markdown
### Issue N: [Short description] (Severity)

- **Severity:** Critical / Major / Minor / Low
- **Affected command(s):** `channels subscribe`, `channels presence enter`
- **Affected mode(s):** Human-readable only / JSON only / Both
- **Description:** Clear explanation of what's wrong.
- **Steps to reproduce:**
  1. Run `pnpm cli channels subscribe test-ch --duration 5`
  2. Observe stderr output
- **Expected:** "Holding presence. Press Ctrl+C to exit."
- **Actual:** "Holding presence. Press Ctrl+C to exit. Press Ctrl+C to exit."
```

### Template: Cross-Mode Analysis

```markdown
## Cross-Mode Analysis

### Field Parity
- JSON output contains all fields from human-readable output [plus: list extras]
- Human-readable output [does / does not] show fields missing from JSON
- Timestamps formatted consistently: [describe]

### JSON Envelope Correctness
- One-shot results: `type: "result"`, `success: true`, domain key: [list keys used]
- Streaming events: `type: "event"`, domain key: [key]
- Status signals: `type: "status"` with [list statuses]
- Error responses: `type: "error"`, `success: false`, nested `error` object
- Completed signal: [present/missing] on all commands with `exitCode`

### stdout Cleanliness (JSON mode)
- JSON mode stdout is [clean / has leaks]: [describe]
- All JSON valid (verified with `jq`): [yes/no]
- Progress/success messages correctly suppressed: [yes/no]
```

### Template: Subscribe-Publish Workflow Validation (for REPORT_PRIMARY.md)

```markdown
### Workflow: Subscribe + Publish — `channels`

| Check | Result | Notes |
|-------|--------|-------|
| Subscriber connects (progress on stderr) | PASS/FAIL | |
| Listening message on stderr (not stdout) | PASS/FAIL | |
| **Subscriber received ≥1 message (non-empty)** | PASS/FAIL | **CRITICAL: empty = FAIL** |
| All published messages received on stdout | PASS/FAIL | Count: N/N |
| Messages received in order | PASS/FAIL | |
| Timestamps present and valid | PASS/FAIL | |
| Clean exit after duration (code 0) | PASS/FAIL | |

**History Verification:**

| Check | Result | Notes |
|-------|--------|-------|
| **History returned ≥1 record (non-empty)** | PASS/FAIL | **CRITICAL: empty = FAIL** |
| Published messages in history | PASS/FAIL | Count: N/N |
| Correct chronological order | PASS/FAIL | |
| Message data intact | PASS/FAIL | |
```

### Template: CRUD Lifecycle Validation (for REPORT_PRIMARY.md)

```markdown
### CRUD Lifecycle: `ably <group>`

| Step | Command | Exit Code | Result | Notes |
|------|---------|-----------|--------|-------|
| Create | `<group> create ...` | N | PASS/FAIL | |
| List | `<group> list` | N | PASS/FAIL | Created resource visible |
| Get | `<group> get <id>` | N | PASS/FAIL | Fields match create |
| Update | `<group> update <id> ...` | N | PASS/FAIL | Change reflected |
| Delete | `<group> delete <id> --force` | N | PASS/FAIL | |
| **Cleanup** | Verify all test resources deleted | | PASS/FAIL | **MANDATORY** |
```

### Template: Observe-Only Subscribe Validation (for REPORT_PRIMARY.md)

```markdown
### Observe-Only: `ably <group> <subcommand> subscribe`

| Check | Result | Notes |
|-------|--------|-------|
| Command connects successfully | PASS/FAIL | Progress messages on stderr |
| Listening/Subscribed signal on stderr | PASS/FAIL | |
| Clean exit after duration (code 0) | PASS/FAIL | |
| No errors or stack traces | PASS/FAIL | |
| `status: "listening"` in JSON mode | PASS/FAIL | |
| `status: "completed"` in JSON mode | PASS/FAIL | |
| Events captured (bonus, not required) | YES/NO | Count: N events |

**Note:** Empty event output is NOT a failure for observe-only subscribe commands.
```

### Template: Hold Command Validation (for REPORT_PRIMARY.md)

```markdown
### Hold: `ably <group> <subgroup> enter/set/acquire`

| Check | Result | Notes |
|-------|--------|-------|
| Hold command emits success + holding status | PASS/FAIL | |
| **Get returns non-empty while hold is active** | PASS/FAIL | **CRITICAL: empty = FAIL** |
| **Subscribe receives ≥1 event** | PASS/FAIL | **CRITICAL: empty = FAIL** |
| Clean exit after duration (code 0) | PASS/FAIL | |
| JSON output correct at each step | PASS/FAIL | |
```

### Template: Help Validation (for REPORT_PRIMARY.md)

```markdown
### Help Validation: `ably <group> <subcommand>`

| Check | Result | Notes |
|-------|--------|-------|
| USAGE section present | PASS/FAIL | |
| All flags documented | PASS/FAIL | Missing: [list] |
| Flag descriptions accurate | PASS/FAIL | |
| Flag aliases listed | PASS/FAIL | e.g., -D for --duration |
| Required args marked | PASS/FAIL | |
| Description matches behavior | PASS/FAIL | |
```

---

## Per-Mode Report Footer Template

Append this footer to REPORT_NON_JSON.md and REPORT_JSON.md after all command sections are written. Data comes from the finalized `manifest.json`.

```markdown
---

## Report Integrity Summary

- **Total sections:** [count of ### sections in this report]
- **Manifest entries for this report:** [count from manifest.json where reportFile matches]
- **Section/manifest match:** [Yes if counts equal, No + discrepancy details if not]
- **All outputs sourced from temp files via Read tool:** Yes
- **JSON validation (REPORT_JSON.md only):** [N/N passed — from manifest validation.jsonValid]
- **Stream contamination detected (REPORT_JSON.md only):** [None / N commands — list affected]
- **Truncated outputs re-read with chunking:** [None / N commands — list affected]
- **Readiness timeouts in workflows:** [None / N workflows — list affected]
- **Report generated:** [ISO-8601 timestamp]
- **Manifest path:** CLAUDE-BEHAVIOR-TESTING/<group>/manifest.json
```

This footer is a self-audit seal. Anyone reviewing the report can verify completeness at a glance. If the section count doesn't match the manifest, something was dropped or duplicated.

---

## Primary Report Footer Template

Append this to REPORT_PRIMARY.md after all analysis sections:

```markdown
---

## Integrity & Traceability

- **Manifest:** CLAUDE-BEHAVIOR-TESTING/<group>/manifest.json
- **Total executions tracked:** N
- **Help report sections:** N (verified against manifest)
- **Non-JSON report sections:** N (verified against manifest)
- **JSON report sections:** N (verified against manifest)
- **JSON validation pass rate:** N/N
- **Stream contamination incidents:** N
- **Readiness timeouts:** N
- **Reports:**
  - [Help Output](REPORT_HELP.md) — N sections
  - [Human-Readable Output](REPORT_NON_JSON.md) — N sections
  - [JSON Output](REPORT_JSON.md) — N sections
```
