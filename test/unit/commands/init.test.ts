import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("init command", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "init-test-"));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("should show help with --help flag", async () => {
    const { stdout } = await runCommand(["init", "--help"], import.meta.url);
    expect(stdout).toContain("Set up Ably for AI-powered development");
    expect(stdout).toContain("--skip-auth");
    expect(stdout).toContain("--global");
    expect(stdout).toContain("--target");
    expect(stdout).toContain("--force");
  });

  it("should list all target options in help", async () => {
    const { stdout } = await runCommand(["init", "--help"], import.meta.url);
    expect(stdout).toContain("claude-code");
    expect(stdout).toContain("cursor");
    expect(stdout).toContain("agents");
    expect(stdout).toContain("auto");
    expect(stdout).toContain("vscode");
    expect(stdout).toContain("windsurf");
    expect(stdout).toContain("zed");
    expect(stdout).toContain("continue");
  });

  it("should accept --skip-auth flag", async () => {
    // With skip-auth and a non-existent repo, it should fail on download
    // but not try to authenticate
    const { error } = await runCommand(
      [
        "init",
        "--skip-auth",
        "--target",
        "all",
        "--skills-repo",
        "ably/nonexistent-repo-xyz-12345",
      ],
      import.meta.url,
    );

    // Should fail on download, not auth
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/Failed to download skills|Not Found/i);
  });

  it("should reject unknown flags", async () => {
    const { error } = await runCommand(
      ["init", "--unknown-flag"],
      import.meta.url,
    );

    expect(error).toBeDefined();
    expect(error!.message).toMatch(/unknown|Nonexistent flag/i);
  });
});
