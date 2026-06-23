# Ably CLI Exit Codes

This document describes the exit codes used by the Ably CLI, particularly in interactive mode.

## Exit Codes

### 0 - Success
- Normal successful completion of a command
- Clean exit after the user types `exit` (when not running under a session restart loop)

### 42 - User Exit (Interactive Mode)
- Special exit code emitted when the user types `exit` while running under a session restart loop (`ABLY_WRAPPER_MODE=1`)
- Signals the restart loop (e.g. the Ably terminal server's session entrypoint) to stop, rather than treating the exit as a crash to relaunch
- Defined as `Interactive.EXIT_CODE_USER_EXIT`

### 130 - SIGINT (Ctrl+C)
- Standard Unix exit code for SIGINT (128 + 2)
- Used when:
  - Double Ctrl+C (force quit) in interactive mode
  - Single Ctrl+C in non-interactive mode
  - Any SIGINT that causes process termination

### 143 - SIGTERM
- Standard Unix exit code for SIGTERM (128 + 15)
- Used when process receives SIGTERM signal

### 1 - General Error
- Generic error exit code
- Used for initialization failures or unexpected errors

## Interactive Mode Behavior

### Single Ctrl+C
- **At empty prompt**: Shows "^C" and message about typing 'exit' to quit
- **During command execution**: Interrupts the command and returns to prompt
- **With partial command typed**: Clears the line and returns to prompt

### Double Ctrl+C (within 500ms)
- **Force quit**: Immediately exits with code 130
- Shows "⚠ Force quit" message
- Bypasses normal cleanup

## Session Restart Loop Behavior

`ably interactive` is a normal command and handles Ctrl+C in-process — the CLI no longer ships a separate `ably-interactive` wrapper binary. A host that wants the interactive shell to survive a force-quit (for example the Ably terminal server, which keeps a browser session alive) can wrap `ably interactive` in a small restart loop, set `ABLY_WRAPPER_MODE=1`, and key the loop off these exit codes:

- **Exit code 42**: User typed 'exit' - stop the loop
- **Exit code 0**: Normal exit - stop the loop
- **Exit code 130**: Force quit (double Ctrl+C) - relaunch the shell
- **Other codes**: Show an error and relaunch after a short delay

## Implementation Details

Exit codes are handled in:
- `src/commands/interactive.ts`: Sets exit code 42 for user exit
- `src/utils/sigint-exit.ts`: Handles SIGINT behavior and exit code 130

---

## Related

- [Interactive-REPL.md](Interactive-REPL.md) — Interactive mode architecture
- [Troubleshooting.md](Troubleshooting.md#interactive-mode-issues) — Common interactive mode issues