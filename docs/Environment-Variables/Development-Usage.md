# Environment Variables — Development Stage Usage

These variables are for CLI contributors, development, testing, and internal modes. They are **not intended for end-user configuration** unless explicitly noted.

> For user-facing environment variables (authentication, configuration, behavioral control, host overrides), run `ably env` in your terminal.

---

## Quick Reference

| Variable | Category | Purpose | Default |
| --- | --- | --- | --- |
| `ABLY_SHOW_DEV_FLAGS` | Development | Reveal hidden dev flags | Not set |
| `ABLY_CONTROL_HOST` | Host Override | Override Control API host | `control.ably.net` |
| `ABLY_DASHBOARD_HOST` | Host Override | Override Ably dashboard URL | `https://ably.com` |
| `DEBUG` | Debugging | oclif framework debug output | Not set |
| `TERMINAL_DIAGNOSTICS` | Debugging | Terminal state diagnostics | Not set |
| `ABLY_CLI_TEST_MODE` | Testing | Enable test mode | Not set |
| `SKIP_CONFIRMATION` | Testing | Auto-confirm prompts (test alias for `ABLY_CLI_NON_INTERACTIVE`) | Not set |
| `GENERATING_DOC` | Tooling | Doc generation mode | Not set |
| `CI` | Environment | CI detection | Not set |
| `ABLY_INTERACTIVE_MODE` | Internal | Interactive shell mode flag | Not set |
| `ABLY_WRAPPER_MODE` | Internal | Wrapper script detection | Not set |
| `ABLY_SUPPRESS_WELCOME` | Internal | Suppress welcome logo | Not set |
| `ABLY_WEB_CLI_MODE` | Internal | Web browser CLI mode | Not set |
| `ABLY_ANONYMOUS_USER_MODE` | Internal | Anonymous web CLI mode | Not set |
| `ABLY_CURRENT_COMMAND` | Internal | Current command tracking | Set automatically |
| `NODE_ENV` | Internal | Node environment override | Not set |
