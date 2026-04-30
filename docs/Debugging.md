# Debugging Guide

This guide provides tips for debugging common issues when developing the Ably CLI.

## General Tips

*   **Check Logs:** Look for errors or relevant messages in the CLI output, test runner output, server logs (for Web CLI tests), or browser console (for Web CLI tests).
*   **Isolate the Issue:** Try to reproduce the problem with the simplest possible command or test case. Comment out parts of the code or test to narrow down the source of the error.
*   **Consult Documentation:** Review relevant project docs (`docs/`, `AGENTS.md`) and Ably documentation (<https://ably.com/docs>).

## Debugging Tests

Refer to [Testing.md](Testing.md) for how to run specific tests.

### Vitest Tests (Unit, Integration, E2E)

*   **`console.log`:** Add temporary `console.log` statements in the test or the code being tested.
*   **Mocking Issues (Unit/Integration):**
    *   Verify mocks (`vitest`, `nock`) are correctly set up and restored (`beforeEach`/`afterEach`).
    *   Ensure stubs match the actual function signatures.
    *   Check that network requests are being intercepted as expected (e.g., using `nock.recorder`).
*   **E2E Failures:**
    *   **Credentials:** Ensure `E2E_ABLY_API_KEY` (and any other required keys) are correctly set in your environment (`.env` file locally, secrets in CI).
    *   **Network:** Check for network connectivity issues to Ably services.
    *   **Resource Conflicts:** Ensure previous test runs cleaned up resources correctly (e.g., unique channel names per test run).
    *   **CI vs. Local:** If tests fail only in CI, suspect environment differences (Node version, dependencies, permissions, resources). Check CI logs carefully.

### Playwright Tests (Web CLI)

*   **Test Output:** Playwright provides detailed error messages, including:
    *   The specific action that failed (e.g., `locator.waitFor`, `expect.toContainText`).
    *   The expected vs. received values.
    *   Call logs showing the sequence of actions.
*   **Error Context:** Check the linked `error-context.md` file in `test-results/` for screenshots, DOM snapshots, and console logs at the point of failure.
*   **Browser Console:** Add `page.on('console', ...)` listeners in your test (as shown in `.specstory` examples) to capture browser logs.
*   **Debugging UI Mode:** Run Playwright with the UI for interactive debugging:
    ```bash
    pnpm exec playwright test test/e2e/web-cli/web-cli.test.ts --ui
    ```
*   **Common Issues:**
    *   **Selector Timeouts:** The element didn't appear within the timeout. Check if the server/app started correctly, if there were errors, or if the selector is correct.
    *   **Incorrect Text/Assertions:** The expected text doesn't match the actual text in the terminal (check for subtle differences like whitespace, case sensitivity, or ANSI codes if not using `toContainText`).
    *   **Connection Errors:** Check browser console logs and terminal server logs for WebSocket connection issues (e.g., wrong port, server crash, `ERR_CONNECTION_REFUSED`).
    *   **Build Artifacts:** Ensure the Web CLI example (`examples/web-cli`) was built successfully (`pnpm --filter ably-web-cli-example build`) before the test runs, especially in CI.

## Debugging the CLI Locally

*   **Run with Node Inspector:**
    ```bash
    node --inspect-brk bin/run.js [your command and flags]
    ```
    Attach your debugger.
*   **Verbose Flags:** Use the CLI's built-in `--verbose` flag if available for the command.
*   **Oclif Debugging:** Set the `DEBUG` environment variable for oclif internal logs:
    ```bash
    DEBUG=oclif* bin/run.js [command]
    ```
*   **Terminal Diagnostics:** Enable terminal state logging for TTY/stdin/stdout issues:
    ```bash
    TERMINAL_DIAGNOSTICS=1 ably-interactive
    ```
*   **Check Configuration:** Use `ably config show` to view stored credentials or `ably config path` to find the config file location.
*   **Override Configuration:** Use environment variables to override config for testing:
    ```bash
    ABLY_API_KEY=your_key ably channels list
    ```

---

## Related

- [Development Stage](Environment-Variables/Development-Usage.md) Env Variables — Development, testing, debugging, and internal env variables. For user-facing variables, run `ably env`.
- [Testing Guide](Testing.md) — Test layers, running tests, and debugging E2E failures
- [E2E Testing CLI Runner](E2E-Testing-CLI-Runner.md) — E2E test runner debugging flags (`E2E_DEBUG`, `ABLY_CLI_TEST_SHOW_OUTPUT`)
- [Troubleshooting](Troubleshooting.md) — Solutions for common build, test, and runtime issues
