import { forceExit } from "../helpers/e2e-test-helper.js";

/**
 * Register SIGINT handler once for the E2E test process. Individual test files
 * used to register and unregister this in every `beforeAll`/`afterAll` pair —
 * that was pure duplication, because node's SIGINT listener lives on the
 * process, not the describe block. A single registration at process start is
 * sufficient, and the listener is cleaned up when the process exits.
 */
process.on("SIGINT", forceExit);
