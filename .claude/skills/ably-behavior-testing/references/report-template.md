# Report Template

Use these templates for each command entry in the test reports.

---

## Template: Individual Command Report

```markdown
---

### `ably <group> <subcommand>`

**Full Command:**
\`\`\`bash
pnpm cli <group> <subcommand> [args] [flags]
\`\`\`

**Description:**
Brief explanation of what the command does, based on `--help` and Ably documentation.

**Flags Tested:**
| Flag | Value | Purpose |
|------|-------|---------|
| `--flag-name` | `value` | What it does |

**Output (stdout):**
\`\`\`
[Paste actual stdout here]
\`\`\`

**Stderr:**
\`\`\`
[Paste actual stderr here — progress messages, warnings, etc.]
\`\`\`

**Exit Code:** N

**Review & Analysis:**

| Check | Result | Notes |
|-------|--------|-------|
| Command executes successfully | PASS/FAIL | |
| Exit code correct | PASS/FAIL | Expected: 0, Got: N |
| Output on correct stream (stdout) | PASS/FAIL | |
| Progress/errors on stderr | PASS/FAIL | |
| Output format correct for mode | PASS/FAIL | |
| All expected fields present | PASS/FAIL | List missing fields |
| Matches documented behavior | PASS/FAIL | |
| Consistent with other output modes | PASS/FAIL | Note differences |
| Error handling appropriate | PASS/FAIL | |

**Issues Found:**
- [ ] Issue description (Severity: Critical/Major/Minor)
  - **Expected:** What should happen
  - **Actual:** What happened
  - **Affected Modes:** human-readable / --pretty-json / all
  - **Steps to Reproduce:**
    1. Step 1
    2. Step 2

---
```

## Template: Help Validation

```markdown
---

### `ably <group> <subcommand> --help`

**Full Command:**
\`\`\`bash
pnpm cli <group> <subcommand> --help
\`\`\`

**Output:**
\`\`\`
[Paste actual --help output here]
\`\`\`

**Help Validation:**

| Check | Result | Notes |
|-------|--------|-------|
| USAGE section present | PASS/FAIL | |
| All flags documented | PASS/FAIL | List missing flags |
| Flag descriptions accurate | PASS/FAIL | |
| Flag aliases listed | PASS/FAIL | e.g., -D for --duration |
| Required args marked | PASS/FAIL | |
| Examples valid | PASS/FAIL | |
| Description matches behavior | PASS/FAIL | |

---
```

## Template: Topic-Level Help

```markdown
---

### `ably <group> --help`

**Full Command:**
\`\`\`bash
pnpm cli <group> --help
\`\`\`

**Output:**
\`\`\`
[Paste actual topic help output here]
\`\`\`

**Topic Help Validation:**

| Check | Result | Notes |
|-------|--------|-------|
| Lists all subcommands | PASS/FAIL | Missing: list any missing |
| No extra/removed subcommands | PASS/FAIL | Extra: list any extra |
| Descriptions match actual behavior | PASS/FAIL | |
| Topic description is clear | PASS/FAIL | |

---
```

## Template: Subscribe-Publish Workflow

```markdown
---

### Workflow: Subscribe + Publish — `<group>`

**Subscribe Command:**
\`\`\`bash
pnpm cli <group> subscribe <resource> --duration 15
\`\`\`

**Publish Commands:**
\`\`\`bash
pnpm cli <group> publish <resource> "Message 1"
pnpm cli <group> publish <resource> "Message 2"
pnpm cli <group> publish <resource> "Message 3"
\`\`\`

**Subscriber stdout:**
\`\`\`
[Paste subscriber stdout showing received messages]
\`\`\`

**Subscriber stderr:**
\`\`\`
[Paste subscriber stderr showing progress/listening messages]
\`\`\`

**Subscriber Exit Code:** N

**Validation:**

| Check | Result | Notes |
|-------|--------|-------|
| Subscriber connects (progress on stderr) | PASS/FAIL | |
| Listening message on stderr (not stdout) | PASS/FAIL | |
| No data received before publish | PASS/FAIL | |
| All published messages received on stdout | PASS/FAIL | Count: N/N |
| Messages received in order | PASS/FAIL | |
| Output format correct for mode | PASS/FAIL | |
| Timestamps present and valid | PASS/FAIL | |
| Clean exit after duration (code 0) | PASS/FAIL | |

**History Verification:**
\`\`\`bash
pnpm cli <group> history <resource> --limit 10
\`\`\`

**History stdout:**
\`\`\`
[Paste history output]
\`\`\`

**History Exit Code:** N

| Check | Result | Notes |
|-------|--------|-------|
| Published messages in history | PASS/FAIL | Count: N/N |
| Correct chronological order | PASS/FAIL | |
| Message data intact | PASS/FAIL | |

---
```

## Template: Error Path

```markdown
---

### Error: `ably <group> <subcommand>` — [Error Scenario]

**Full Command:**
\`\`\`bash
pnpm cli <group> <subcommand> [invalid args/flags]
\`\`\`

**Expected Behavior:**
Clear error message indicating [what went wrong] with actionable guidance.

**stdout:**
\`\`\`
[Paste stdout — should be empty or contain JSON error envelope in --pretty-json mode]
\`\`\`

**stderr:**
\`\`\`
[Paste stderr — error messages appear here]
\`\`\`

**Exit Code:** N (expected: non-zero)

**Validation:**

| Check | Result | Notes |
|-------|--------|-------|
| Error message clear | PASS/FAIL | |
| Exits with non-zero code | PASS/FAIL | Exit code: N |
| Error on stderr (not stdout) | PASS/FAIL | |
| Actionable guidance provided | PASS/FAIL | |
| No stack traces leaked | PASS/FAIL | |
| JSON error envelope (if --pretty-json) | PASS/FAIL | type: "error", success: false |

---
```

## Template: JSON Validation (for --pretty-json streaming)

```markdown
---

### JSON Validation: `ably <group> <subcommand> --pretty-json`

**Full Command:**
\`\`\`bash
pnpm cli <group> <subcommand> [args] --pretty-json --duration N
\`\`\`

**Raw stdout:**
\`\`\`
[Paste raw stdout — should be valid JSON]
\`\`\`

**Validation:**

| Check | Result | Notes |
|-------|--------|-------|
| Valid JSON output | PASS/FAIL | |
| No non-JSON text on stdout | PASS/FAIL | |
| Correct envelope structure | PASS/FAIL | |
| Consistent domain key | PASS/FAIL | |
| Parseable by `jq` | PASS/FAIL | `stdout | jq .` succeeds |

---
```

## Template: Control API CRUD Workflow

```markdown
---

### CRUD Workflow: `ably <group>`

**Create:**
\`\`\`bash
pnpm cli <group> create [args] [flags]
\`\`\`
- Exit Code: N
- stdout: [summary of output]

**List (verify created):**
\`\`\`bash
pnpm cli <group> list
\`\`\`
- Exit Code: N
- Created resource appears: YES/NO

**Get (if available):**
\`\`\`bash
pnpm cli <group> get <id>
\`\`\`
- Exit Code: N
- Fields match create response: YES/NO

**Update (if available):**
\`\`\`bash
pnpm cli <group> update <id> [flags]
\`\`\`
- Exit Code: N
- Change reflected in subsequent get: YES/NO

**Delete:**
\`\`\`bash
pnpm cli <group> delete <id> --force
\`\`\`
- Exit Code: N
- Resource gone from list: YES/NO

**Validation:**

| Check | Result | Notes |
|-------|--------|-------|
| Full CRUD lifecycle works | PASS/FAIL | |
| --force required for delete | PASS/FAIL | |
| JSON output correct at each step | PASS/FAIL | |
| Error on non-existent resource | PASS/FAIL | |

---
```
