import { runCommand } from "@oclif/test";
import { describe, it, expect } from "vitest";

// This is the absolute minimum test to see if oclif tests work at all
describe("Minimal oclif test", function () {
  // Just try to execute the help command which should be fast and reliable
  it("runs help command", async function () {
    // Try to run the simplest possible command
    const { stdout } = await runCommand(["help"]);
    expect(stdout).toContain("$ ably [COMMAND]");
  });
});
