import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCommand } from "@oclif/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  standardHelpTests,
  standardArgValidationTests,
  standardFlagTests,
} from "../../../helpers/standard-tests.js";

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as typeof fetch;

describe("skills:install command", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-install-test-"));
    originalCwd = process.cwd();
    process.chdir(tempDir);
    fetchMock.mockReset();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  standardHelpTests("skills:install", import.meta.url);
  standardArgValidationTests("skills:install", import.meta.url);
  standardFlagTests("skills:install", import.meta.url, [
    "--global",
    "--target",
    "--force",
    "--skill",
    "--skills-repo",
    "--json",
  ]);

  describe("flags", () => {
    it("should list all target options in help", async () => {
      const { stdout } = await runCommand(
        ["skills:install", "--help"],
        import.meta.url,
      );
      expect(stdout).toContain("claude-code");
      expect(stdout).toContain("cursor");
      expect(stdout).toContain("agents");
      expect(stdout).toContain("auto");
      expect(stdout).toContain("vscode");
      expect(stdout).toContain("windsurf");
      expect(stdout).toContain("zed");
      expect(stdout).toContain("continue");
    });
  });

  describe("error handling", () => {
    it("should surface download failures", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        statusText: "Not Found",
      } as Response);

      const { error } = await runCommand(
        [
          "skills:install",
          "--target",
          "all",
          "--skills-repo",
          "ably/nonexistent-repo-xyz-12345",
        ],
        import.meta.url,
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Failed to download skills|Not Found/i);
    });
  });
});
