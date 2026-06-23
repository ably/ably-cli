# Manual Test Instructions for Interactive Mode

## Overview

This document provides manual test cases for interactive mode (`ably interactive`).

Interactive mode runs as a single Node process and handles Ctrl+C **in-process** —
there is no longer a separate `ably-interactive` bash wrapper. A single Ctrl+C
interrupts the running command and returns to the prompt; a double Ctrl+C (within
500ms) force-quits with exit code 130. The "restart the shell after a force-quit"
behaviour previously provided by the wrapper is now optional and owned by the host
(e.g. the Ably terminal server wraps `ably interactive` in a small restart loop;
see `docs/Exit-Codes.md`).

## Prerequisites

1. Build the project: `pnpm build`
2. Ensure you have a valid Ably account configured
3. Run these in a **real terminal** (not an IDE/script stdio) so Ctrl+C is delivered as a signal

## Test Cases

### 1. Basic Interactive Mode

```bash
node bin/run.js interactive
```

**Expected behavior:**
- Welcome message appears
- `ably>` prompt is shown
- Commands execute inline
- A dim hint explains Ctrl+C/`exit` behaviour
- Type `exit` to quit (exit code 0)

### 2. Long-Running Command Interruption (single Ctrl+C)

```bash
node bin/run.js interactive
# At the prompt:
ably> test:wait --duration 30
# Press Ctrl+C while it is waiting
```

**Expected behavior:**
- Command starts running ("Waiting for ...")
- Single Ctrl+C interrupts the command and shows stopping feedback
- The **same process** returns to a new `ably>` prompt (no restart, no welcome message)
- No `setRawMode EIO` / terminal-corruption errors
- Repeat several times — behaviour stays stable

### 3. Double Ctrl+C (force quit)

```bash
node bin/run.js interactive
ably> test:wait --duration 30
# Press Ctrl+C twice rapidly (within 500ms) while it is waiting
```

**Expected behavior:**
- `⚠ Force quit` is shown
- Process exits with code 130 (`echo $?`)
- (Under a host restart loop with `ABLY_WRAPPER_MODE=1`, the host would relaunch the shell instead — see test 6)

### 4. Interactive Prompts

```bash
node bin/run.js interactive
ably> apps create test-app
```

**Expected behavior:**
- Command prompts for confirmation (Y/N)
- Typing Y or N works correctly and is processed by the command

### 5. Command History

```bash
node bin/run.js interactive
ably> help
ably> version
ably> exit

# Start again and press the up arrow
node bin/run.js interactive
```

**Expected behavior:**
- Up arrow recalls previous commands in reverse order
- History persists across sessions in `~/.ably/history`

### 6. Exit Code Contract

```bash
# Normal exit
node bin/run.js interactive
ably> exit
echo $?   # 0

# Restart-loop contract: with ABLY_WRAPPER_MODE=1, `exit` returns 42 so a host
# restart loop knows to stop (rather than relaunch). 130 = force quit.
ABLY_WRAPPER_MODE=1 node bin/run.js interactive
ably> exit
echo $?   # 42
```

### 7. Error Handling

```bash
node bin/run.js interactive
ably> invalid-command
ably> apps invalid-subcommand
```

**Expected behavior:**
- Error messages appear
- Shell continues running and shows a new prompt

### 8. Rapid Ctrl+C at the Prompt

```bash
node bin/run.js interactive
# Press Ctrl+C several times at an empty prompt
```

**Expected behavior:**
- Each shows `^C` and a hint to type `exit`
- Shell remains stable (no crashes); a rapid double-press force-quits with 130

### 9. Custom History File

```bash
ABLY_HISTORY_FILE=/tmp/test-history node bin/run.js interactive
ably> help
ably> exit
cat /tmp/test-history
```

### 10. Cross-Platform

The single `ably` bin works on all platforms, and Ctrl+C is handled in-process, so
interactive mode no longer depends on a bash wrapper (macOS/Linux/Windows behave
the same). Any restart-on-force-quit behaviour is a host concern, not the CLI's.

## Verification Checklist

- [ ] Interactive mode starts successfully
- [ ] Commands execute without spawn overhead
- [ ] Single Ctrl+C interrupts a long-running command and returns to the prompt in-process
- [ ] No terminal corruption (`setRawMode EIO`) across repeated interrupts
- [ ] Double Ctrl+C force-quits with exit code 130
- [ ] `exit` returns 0 normally, and 42 under `ABLY_WRAPPER_MODE=1`
- [ ] Interactive prompts (Y/N) work correctly
- [ ] Command history persists in `~/.ably/history`
- [ ] Error handling doesn't crash the shell
- [ ] Welcome message shows once (suppressed by `ABLY_SUPPRESS_WELCOME=1`)

## Notes

- Ctrl+C at the prompt prints `^C` and a hint rather than clearing the line.
- For automated coverage of the SIGINT/terminal behaviour, see
  `test/tty/commands/interactive-sigint.test.ts` (run with `pnpm test:tty`).
