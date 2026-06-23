# Interactive ([Immersive](https://github.com/dthree/vorpal)) CLI

> Interactive mode now ships as the hidden `ably interactive` command. The
> background below records the original motivation; the
> [Current design](#current-design) section documents how it actually works today.

The Ably CLI is designed to be run as a traditional command line tool, where commands are run individually from a bash-like shell. Between each invocation of commands, the entire CLI environment is loaded and executed. This model works very well for a locally installed CLI.

However, the Ably CLI is also available as a Web Terminal CLI as a convenience for Ably customers who are logged in or browsing the docs, with a CLI drawer available to slide up and execute commands. This is made possible with a local restricted shell within a secure container being spawned for each session, with STDIN/STDOUT streamed over a WebSocket connection.

This model is operational today and works largely as expected, however it has some unexpected tradeoffs:

- There is some lag loading the Ably CLI within a restricted container for each request, typically a few hundred milliseconds. This coupled with the roundtrip latency becomes noticeable, although definitely still workable.
- Auto-complete does not work because of the security restrictions in place in the container and restricted shell. Working around this is proving very difficult, hacky or compromises on the security posture we were aiming for.

I would like to explore an alternative route where the Ably CLI supports an interactive ([immersive](https://github.com/dthree/vorpal)) CLI mode which would:

- Allow the CLI to be launched and remain running between commands (this will reduce latency by removing the need for the bootstrap sequence for every command)
- Offer all the same commands with the same Ably CLI syntax (commands and arguments) within the interactive mode. This consistency is important so that users dropping into the local CLI will get the same experience.
- Provide rich autocomplete functionality to ensure we deliver a great developer experience, similar to what `zsh` offers
- Provide history (Cmd+R / up)
- Handle Ctrl-C naturally - interrupt running commands, show helpful message at prompt
- Interactive REPL should feel like a standard shell, with the $ prompt for example
- Support for rich TUI terminal functionality such as progress indicators and inline table updates

## Technical considerations

There are some relevant Node.js projects we can draw inspiration from:

- [Vorpal interactive CLI](https://vorpal.js.org/) with source code at https://github.com/dthree/vorpal
- [Inquirer package](https://www.npmjs.com/package/inquirer) for common interactive command line user interface commands

[oclif](https://oclif.io/) does not appear to have any plugins to support an interactive/embedded CLI mode.
However, a [REPL plugin](https://github.com/sisou/oclif-plugin-repl) exists, although that's unlikely to share much with the goals of interactive CLI.

If there are any existing libraries that we can depend on to enable this functionality, that should be our preference to keep the CLI complexity low. However, any dependencies used should be well maintained and popular. If the additional dependencies to support this functionality add any material bloat, we should consider how this functionality can be added as an optional plugin so that the standard locally installed CLI has minimal dependencies.

## Current design

Interactive mode ships as the hidden `ably interactive` command (currently ALPHA).
It is implemented in [`src/commands/interactive.ts`](../src/commands/interactive.ts)
and runs as a single long-lived process: the welcome banner and a short list of
common commands print once, then a readline loop presents an `ably> ` prompt and
executes each entered command **in-process** via oclif's `Config.runCommand`.
There is no per-command spawn, so there is no bootstrap cost between commands.

Key behaviours:

- **In-process execution** — commands run in the same process as the shell, so there is no spawn overhead between commands.
- **Ctrl+C** — handled in-process (see [`src/utils/sigint-exit.ts`](../src/utils/sigint-exit.ts)). A single Ctrl+C while a command is running interrupts that command and returns to the prompt; a second Ctrl+C force-quits. At an empty prompt it prints a hint to type `exit`; with text already on the line it clears the line, zsh-style.
- **Exit** — type `exit` (or `.exit`), or press Ctrl+D. The shell exits `0` normally, or with code `42` when `ABLY_WRAPPER_MODE=1` so a host can distinguish a deliberate quit from an interrupt (`130`). See [Exit Codes](Exit-Codes.md).
- **History** — persisted to `~/.ably/history` (override with `ABLY_HISTORY_FILE`) by `HistoryManager`, with up/down recall and Ctrl+R reverse search.
- **Autocomplete** — TAB completes commands, subcommands, and flags, read from the oclif manifest. See [Auto-completion](Auto-completion.md).
- **Restricted commands** — commands listed in `INTERACTIVE_UNSUITABLE_COMMANDS` (and, in the web CLI, the web-mode restriction lists) are hidden from completion and rejected if entered.

### No wrapper binary

The CLI ships a single `ably` bin. There is no longer an `ably-interactive` wrapper
binary — it was retired once Ctrl+C was handled in-process. The
auto-restart-on-force-quit behaviour the bash wrapper used to provide is now
optional and owned by whichever host wants it. The Ably terminal server, for
example, wraps `ably interactive` in a small restart loop keyed off exit codes `42`
(user exit) and `130` (interrupt), with `ABLY_WRAPPER_MODE=1` set so the CLI emits
code `42` on a clean exit.

---

## Related

- [Exit Codes](Exit-Codes.md) — Exit codes used in interactive mode
- [Troubleshooting](Troubleshooting.md#interactive-mode-issues) — Common interactive mode issues (unexpected exits, Ctrl+C, history)
- [Auto-completion](Auto-completion.md) — Shell tab completion setup for commands and flags
- [Testing Guide](Testing.md) — Subprocess and TTY test layers for interactive mode
- [Project Structure](Project-Structure.md) — Repository layout including `src/commands/interactive.ts`
