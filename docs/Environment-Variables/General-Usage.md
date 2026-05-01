# Environment Variables — General Usage

These environment variables are most commonly used during development as well as by end users in CI/CD pipelines, scripts, and production use.

> **Note:** The CLI does not automatically load `.env` files. Set environment variables in your shell, CI/CD configuration, or inline with your commands.

---

## Quick Reference

| Variable | Category | Purpose | Default |
| --- | --- | --- | --- |
| `ABLY_API_KEY` | Authentication | API key for data plane commands | None |
| `ABLY_TOKEN` | Authentication | Token/JWT for data plane commands | None |
| `ABLY_ACCESS_TOKEN` | Authentication | Access token for Control API commands | None |
| `ABLY_APP_ID` | App Selection | Default app for `--app` flag | None |
| `ABLY_CLI_CONFIG_DIR` | Configuration | Custom config directory | `~/.ably` |
| `ABLY_HISTORY_FILE` | Configuration | Custom history file location | `~/.ably/history` |
| `ABLY_CLI_DEFAULT_DURATION` | Behavior | Auto-exit long-running commands (seconds) | None (forever) |
| `ABLY_CLI_NON_INTERACTIVE` | Behavior | Auto-confirm "Did you mean?" prompts | Not set |
| `ABLY_ENDPOINT` | Host Override | Override Realtime/REST API endpoint | SDK default |

> For development, testing, debugging, and internal variables, see [Development Stage Usage](Development-Usage.md).
