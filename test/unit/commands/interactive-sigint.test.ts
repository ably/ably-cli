import { describe, it } from "vitest";

describe("Interactive Mode - SIGINT Handling", () => {
  // SIGINT tests have been moved to test/tty/commands/interactive-sigint.test.ts
  // They require a real pseudo-terminal (node-pty) to properly test readline behavior.
  // Run with: pnpm test:tty

  it.todo(
    "see test/tty/commands/interactive-sigint.test.ts for TTY-based SIGINT tests",
  );
});
