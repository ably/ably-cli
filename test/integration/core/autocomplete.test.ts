import { describe, it, expect } from "vitest";
import { runCommand } from "@oclif/test";

describe("autocomplete command", function () {
  it("should have autocomplete command available and show instructions", async function () {
    const { stdout } = await runCommand(["autocomplete"], import.meta.url);

    expect(stdout).toContain("Setup Instructions");
    expect(stdout).toContain("autocomplete");
    // Should detect the current shell and show relevant instructions
    expect(stdout).toMatch(/zsh|bash|powershell/i);
  });

  it("should show bash-specific instructions", async function () {
    const { stdout } = await runCommand(
      ["autocomplete", "bash"],
      import.meta.url,
    );

    expect(stdout).toContain("Setup Instructions");
    expect(stdout).toContain("bash");
    expect(stdout).toContain(".bashrc");
  });

  it("should show zsh-specific instructions", async function () {
    const { stdout } = await runCommand(
      ["autocomplete", "zsh"],
      import.meta.url,
    );

    expect(stdout).toContain("Setup Instructions");
    expect(stdout).toContain("zsh");
    expect(stdout).toContain(".zshrc");
  });

  it("should show powershell-specific instructions", async function () {
    const { stdout } = await runCommand(
      ["autocomplete", "powershell"],
      import.meta.url,
    );

    expect(stdout).toContain("Setup Instructions");
    expect(stdout).toContain("powershell");
  });

  it("should support refresh-cache flag", async function () {
    const { stdout, stderr } = await runCommand(
      ["autocomplete", "--refresh-cache"],
      import.meta.url,
    );

    // The refresh-cache flag causes the cache to be rebuilt
    // The stderr output includes "done" when cache building completes
    expect(stderr || stdout).toContain("done");
  });
});
